-- =============================================================================
-- DAF Smart Search Engine
-- Full-text search with tsvector + GIN index
-- =============================================================================

-- 1. Add search_text column (concatenated searchable content)
ALTER TABLE daf_documents
ADD COLUMN IF NOT EXISTS search_text TEXT;

-- 2. Add tsvector column for indexed search
ALTER TABLE daf_documents
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 3. Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_daf_documents_search
ON daf_documents
USING GIN (search_vector);

-- 4. Create function to build search_text from document fields
CREATE OR REPLACE FUNCTION build_daf_search_text(doc daf_documents)
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(doc.file_name, '') || ' ' ||
         COALESCE(doc.doc_type, '') || ' ' ||
         COALESCE(doc.ai_detected_type, '') || ' ' ||
         COALESCE(doc.fournisseur, '') || ' ' ||
         COALESCE(doc.numero_facture, '') || ' ' ||
         COALESCE(doc.notes, '') || ' ' ||
         COALESCE(doc.full_text, '') || ' ' ||
         COALESCE(doc.montant_ttc::text, '') || ' ' ||
         COALESCE(doc.montant_ht::text, '') || ' ' ||
         COALESCE(doc.date_document::text, '') || ' ' ||
         COALESCE(doc.date_echeance::text, '') || ' ' ||
         COALESCE((doc.key_info->>'supplier')::text, '') || ' ' ||
         COALESCE((doc.key_info->>'name')::text, '') || ' ' ||
         COALESCE((doc.key_info->>'title')::text, '');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Create function to update search_vector
CREATE OR REPLACE FUNCTION update_daf_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  -- Build search_text
  NEW.search_text := build_daf_search_text(NEW);

  -- Build search_vector using 'simple' config (language-agnostic)
  -- Also try 'french' for better French stemming
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.file_name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.fournisseur, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.numero_facture, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.doc_type, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.ai_detected_type, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.notes, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(NEW.full_text, '')), 'D') ||
    setweight(to_tsvector('simple', COALESCE((NEW.key_info->>'supplier')::text, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE((NEW.key_info->>'name')::text, '')), 'A');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger to auto-update search_vector on insert/update
DROP TRIGGER IF EXISTS trg_daf_documents_search ON daf_documents;
CREATE TRIGGER trg_daf_documents_search
BEFORE INSERT OR UPDATE ON daf_documents
FOR EACH ROW
EXECUTE FUNCTION update_daf_search_vector();

-- 7. Backfill existing documents
UPDATE daf_documents
SET search_text = build_daf_search_text(daf_documents),
    search_vector =
      setweight(to_tsvector('simple', COALESCE(file_name, '')), 'A') ||
      setweight(to_tsvector('simple', COALESCE(fournisseur, '')), 'A') ||
      setweight(to_tsvector('simple', COALESCE(numero_facture, '')), 'A') ||
      setweight(to_tsvector('simple', COALESCE(doc_type, '')), 'B') ||
      setweight(to_tsvector('simple', COALESCE(ai_detected_type, '')), 'B') ||
      setweight(to_tsvector('simple', COALESCE(notes, '')), 'C') ||
      setweight(to_tsvector('simple', COALESCE(full_text, '')), 'D') ||
      setweight(to_tsvector('simple', COALESCE((key_info->>'supplier')::text, '')), 'A') ||
      setweight(to_tsvector('simple', COALESCE((key_info->>'name')::text, '')), 'A')
WHERE search_vector IS NULL;

-- 8. Create the search function for the API
CREATE OR REPLACE FUNCTION search_daf_documents(
  p_org_id UUID,
  p_query TEXT,
  p_doc_type TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  file_name TEXT,
  file_path TEXT,
  file_url TEXT,
  file_size_bytes BIGINT,
  file_type TEXT,
  doc_type TEXT,
  ai_detected_type TEXT,
  ai_confidence NUMERIC,
  fournisseur TEXT,
  numero_facture TEXT,
  montant_ht NUMERIC,
  montant_ttc NUMERIC,
  taux_tva NUMERIC,
  date_document DATE,
  date_echeance DATE,
  status TEXT,
  page_count INT,
  table_count INT,
  key_info JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.file_name,
    d.file_path,
    d.file_url,
    d.file_size_bytes,
    d.file_type,
    d.doc_type,
    d.ai_detected_type,
    d.ai_confidence,
    d.fournisseur,
    d.numero_facture,
    d.montant_ht,
    d.montant_ttc,
    d.taux_tva,
    d.date_document,
    d.date_echeance,
    d.status,
    d.page_count,
    d.table_count,
    d.key_info,
    d.notes,
    d.created_at,
    ts_rank(d.search_vector, websearch_to_tsquery('simple', p_query)) AS rank
  FROM daf_documents d
  WHERE d.org_id = p_org_id
    AND (p_query IS NULL OR p_query = '' OR d.search_vector @@ websearch_to_tsquery('simple', p_query))
    AND (p_doc_type IS NULL OR d.ai_detected_type = p_doc_type OR d.doc_type = p_doc_type)
    AND (p_status IS NULL OR d.status = p_status)
  ORDER BY
    CASE WHEN p_query IS NOT NULL AND p_query != ''
         THEN ts_rank(d.search_vector, websearch_to_tsquery('simple', p_query))
         ELSE 0 END DESC,
    d.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- 9. Create a quick search stats function
CREATE OR REPLACE FUNCTION get_daf_search_stats(
  p_org_id UUID,
  p_query TEXT
)
RETURNS TABLE (
  total_results BIGINT,
  by_type JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_results,
    jsonb_object_agg(
      COALESCE(d.ai_detected_type, 'other'),
      type_counts.cnt
    ) as by_type
  FROM (
    SELECT ai_detected_type, COUNT(*) as cnt
    FROM daf_documents
    WHERE org_id = p_org_id
      AND (p_query IS NULL OR p_query = '' OR search_vector @@ websearch_to_tsquery('simple', p_query))
    GROUP BY ai_detected_type
  ) type_counts
  CROSS JOIN daf_documents d
  WHERE d.org_id = p_org_id
    AND (p_query IS NULL OR p_query = '' OR d.search_vector @@ websearch_to_tsquery('simple', p_query))
  GROUP BY type_counts.ai_detected_type, type_counts.cnt
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- 10. Grant permissions
GRANT EXECUTE ON FUNCTION search_daf_documents TO authenticated;
GRANT EXECUTE ON FUNCTION get_daf_search_stats TO authenticated;
