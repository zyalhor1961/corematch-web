-- =====================================================
-- RAG Foundation - Embeddings Schema
-- =====================================================
-- Date: 2025-01-17
-- Objectif: Tables pour stockage chunks + embeddings

-- =====================================================
-- Table principale: content_embeddings
-- Stocke tous les chunks (DAF docs, CVs, etc.) avec leurs embeddings
-- =====================================================

CREATE TABLE IF NOT EXISTS content_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organisation (pour RLS)
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Type de contenu
  content_type TEXT NOT NULL,
  -- Types: 'daf_document', 'cv', 'job_spec', 'autre'

  -- Référence au document source
  source_id UUID NOT NULL,
  -- ID du document dans daf_documents, candidates, etc.

  source_table TEXT NOT NULL,
  -- Table source: 'daf_documents', 'candidates', 'projects'

  -- Métadonnées du document source
  source_metadata JSONB,
  -- Ex: { file_name, doc_type, fournisseur, date_document }

  -- Chunk information
  chunk_index INTEGER NOT NULL,
  -- Position du chunk dans le document (0-based)

  chunk_text TEXT NOT NULL,
  -- Texte du chunk (500-1000 tokens)

  chunk_metadata JSONB,
  -- Métadonnées du chunk: { page_number, section_title, start_char, end_char }

  -- Embedding vector (OpenAI text-embedding-3-small = 1536 dimensions)
  embedding vector(1536),

  -- Statistiques
  token_count INTEGER,
  -- Nombre de tokens dans le chunk (approximatif)

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contrainte unique: un chunk par position dans un document
  UNIQUE(source_id, chunk_index)
);

-- =====================================================
-- Indexes pour performance
-- =====================================================

-- Index pour recherche vectorielle (HNSW = Hierarchical Navigable Small World)
-- HNSW est le meilleur algorithme pour recherche vectorielle à grande échelle
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_hnsw
  ON content_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Index pour filtrage par organisation
CREATE INDEX IF NOT EXISTS idx_embeddings_org
  ON content_embeddings(org_id, content_type);

-- Index pour retrouver tous les chunks d'un document
CREATE INDEX IF NOT EXISTS idx_embeddings_source
  ON content_embeddings(source_id, chunk_index);

-- Index pour recherche par type de contenu
CREATE INDEX IF NOT EXISTS idx_embeddings_type
  ON content_embeddings(content_type, created_at DESC);

-- Index GIN pour recherche full-text dans chunk_text
CREATE INDEX IF NOT EXISTS idx_embeddings_fts
  ON content_embeddings
  USING GIN(to_tsvector('french', chunk_text));

-- Index GIN pour métadonnées JSON
CREATE INDEX IF NOT EXISTS idx_embeddings_metadata
  ON content_embeddings
  USING GIN(source_metadata);

-- =====================================================
-- Triggers
-- =====================================================

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_embeddings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_embeddings_updated_at
  BEFORE UPDATE ON content_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_embeddings_updated_at();

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

ALTER TABLE content_embeddings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access embeddings from their organizations
CREATE POLICY "Users access own org embeddings" ON content_embeddings
  FOR ALL USING (
    org_id IN (
      SELECT org_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- Fonction: Recherche vectorielle avec filtres
-- =====================================================

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

-- =====================================================
-- Fonction: Recherche hybride (vector + FTS + metadata)
-- =====================================================

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

-- =====================================================
-- Fonction: Obtenir tous les chunks d'un document
-- =====================================================

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

-- =====================================================
-- Fonction: Statistiques embeddings par organisation
-- =====================================================

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
-- Comments pour documentation
-- =====================================================

COMMENT ON TABLE content_embeddings IS
  'Stockage des chunks de documents avec embeddings vectoriels pour RAG';

COMMENT ON COLUMN content_embeddings.embedding IS
  'Vector embedding (1536 dimensions, OpenAI text-embedding-3-small)';

COMMENT ON COLUMN content_embeddings.chunk_metadata IS
  'Métadonnées du chunk: { page_number, section_title, start_char, end_char, bounding_box }';

COMMENT ON FUNCTION search_embeddings IS
  'Recherche vectorielle pure (cosine similarity)';

COMMENT ON FUNCTION hybrid_search IS
  'Recherche hybride: vector similarity + full-text search + metadata filters';
