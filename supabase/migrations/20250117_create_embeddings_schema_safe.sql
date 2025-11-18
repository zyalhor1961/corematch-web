-- =====================================================
-- RAG Foundation - Embeddings Schema (SAFE VERSION)
-- =====================================================
-- Date: 2025-01-17
-- Objectif: Tables pour stockage chunks + embeddings
-- Note: Version safe avec IF NOT EXISTS / CREATE OR REPLACE

-- =====================================================
-- Table principale: content_embeddings
-- =====================================================

CREATE TABLE IF NOT EXISTS content_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organisation (pour RLS)
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Type de contenu
  content_type TEXT NOT NULL,

  -- Référence au document source
  source_id UUID NOT NULL,
  source_table TEXT NOT NULL,

  -- Métadonnées du document source
  source_metadata JSONB,

  -- Chunk information
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_metadata JSONB,

  -- Embedding vector (1536 dimensions)
  embedding vector(1536),

  -- Statistiques
  token_count INTEGER,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contrainte unique
  UNIQUE(source_id, chunk_index)
);

-- =====================================================
-- Indexes (safe avec IF NOT EXISTS)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_embeddings_vector_hnsw
  ON content_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_embeddings_org
  ON content_embeddings(org_id, content_type);

CREATE INDEX IF NOT EXISTS idx_embeddings_source
  ON content_embeddings(source_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_embeddings_type
  ON content_embeddings(content_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_embeddings_fts
  ON content_embeddings
  USING GIN(to_tsvector('french', chunk_text));

CREATE INDEX IF NOT EXISTS idx_embeddings_metadata
  ON content_embeddings
  USING GIN(source_metadata);

-- =====================================================
-- Triggers (safe: drop puis create)
-- =====================================================

-- Fonction pour updated_at
CREATE OR REPLACE FUNCTION update_embeddings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger s'il existe, puis recréer
DROP TRIGGER IF EXISTS trigger_embeddings_updated_at ON content_embeddings;

CREATE TRIGGER trigger_embeddings_updated_at
  BEFORE UPDATE ON content_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_embeddings_updated_at();

-- =====================================================
-- Row Level Security
-- =====================================================

ALTER TABLE content_embeddings ENABLE ROW LEVEL SECURITY;

-- Drop policy si existe, puis recréer
DROP POLICY IF EXISTS "Users access own org embeddings" ON content_embeddings;

CREATE POLICY "Users access own org embeddings" ON content_embeddings
  FOR ALL USING (
    org_id IN (
      SELECT org_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- Fonctions SQL (CREATE OR REPLACE)
-- =====================================================

-- Recherche vectorielle
CREATE OR REPLACE FUNCTION search_embeddings(
  query_embedding vector(1536),
  p_org_id UUID,
  p_content_type TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE(
  id UUID,
  source_id UUID,
  source_table TEXT,
  content_type TEXT,
  chunk_text TEXT,
  chunk_metadata JSONB,
  source_metadata JSONB,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.source_id,
    e.source_table,
    e.content_type,
    e.chunk_text,
    e.chunk_metadata,
    e.source_metadata,
    1 - (e.embedding <=> query_embedding) as similarity
  FROM content_embeddings e
  WHERE
    e.org_id = p_org_id
    AND (p_content_type IS NULL OR e.content_type = p_content_type)
    AND (1 - (e.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recherche hybride
CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding vector(1536),
  query_text TEXT,
  p_org_id UUID,
  p_content_type TEXT DEFAULT NULL,
  p_metadata_filters JSONB DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
  vector_weight FLOAT DEFAULT 0.7,
  fts_weight FLOAT DEFAULT 0.3
)
RETURNS TABLE(
  id UUID,
  source_id UUID,
  source_table TEXT,
  content_type TEXT,
  chunk_text TEXT,
  chunk_metadata JSONB,
  source_metadata JSONB,
  vector_similarity FLOAT,
  fts_rank FLOAT,
  combined_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.source_id,
    e.source_table,
    e.content_type,
    e.chunk_text,
    e.chunk_metadata,
    e.source_metadata,
    (1 - (e.embedding <=> query_embedding)) as vector_similarity,
    ts_rank(to_tsvector('french', e.chunk_text), plainto_tsquery('french', query_text)) as fts_rank,
    (
      vector_weight * (1 - (e.embedding <=> query_embedding)) +
      fts_weight * ts_rank(to_tsvector('french', e.chunk_text), plainto_tsquery('french', query_text))
    ) as combined_score
  FROM content_embeddings e
  WHERE
    e.org_id = p_org_id
    AND (p_content_type IS NULL OR e.content_type = p_content_type)
    AND (
      p_metadata_filters IS NULL OR
      e.source_metadata @> p_metadata_filters
    )
  ORDER BY combined_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obtenir chunks d'un document
CREATE OR REPLACE FUNCTION get_document_chunks(
  p_source_id UUID,
  p_org_id UUID
)
RETURNS TABLE(
  id UUID,
  chunk_index INTEGER,
  chunk_text TEXT,
  chunk_metadata JSONB,
  token_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.chunk_index,
    e.chunk_text,
    e.chunk_metadata,
    e.token_count
  FROM content_embeddings e
  WHERE
    e.source_id = p_source_id
    AND e.org_id = p_org_id
  ORDER BY e.chunk_index;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Statistiques embeddings
CREATE OR REPLACE FUNCTION get_embeddings_stats(p_org_id UUID)
RETURNS TABLE(
  total_chunks BIGINT,
  total_documents BIGINT,
  by_content_type JSONB,
  total_tokens BIGINT,
  avg_chunk_size INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_chunks,
    COUNT(DISTINCT source_id) as total_documents,
    jsonb_object_agg(
      content_type,
      count
    ) as by_content_type,
    SUM(token_count) as total_tokens,
    AVG(token_count)::INTEGER as avg_chunk_size
  FROM (
    SELECT
      content_type,
      source_id,
      token_count,
      COUNT(*) OVER (PARTITION BY content_type) as count
    FROM content_embeddings
    WHERE org_id = p_org_id
  ) subquery
  GROUP BY total_chunks, total_documents, total_tokens, avg_chunk_size;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE content_embeddings IS
  'Stockage des chunks de documents avec embeddings vectoriels pour RAG';

COMMENT ON COLUMN content_embeddings.embedding IS
  'Vector embedding (1536 dimensions, OpenAI text-embedding-3-small)';
