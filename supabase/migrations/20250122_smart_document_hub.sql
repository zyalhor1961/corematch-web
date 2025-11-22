-- =====================================================
-- Smart Document Hub - Phase 1+2
-- =====================================================
-- Transform DAF from invoice-only to universal document hub
-- Adds AI detection, page info, and key_info for adaptive display

-- Add new columns for smart document hub
ALTER TABLE daf_documents
  ADD COLUMN IF NOT EXISTS ai_detected_type TEXT,
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS page_count INTEGER,
  ADD COLUMN IF NOT EXISTS table_count INTEGER,
  ADD COLUMN IF NOT EXISTS full_text TEXT,
  ADD COLUMN IF NOT EXISTS key_info JSONB DEFAULT '{}';

-- Comments explaining the new columns
COMMENT ON COLUMN daf_documents.ai_detected_type IS
  'AI-detected document type: invoice, cv, contract, report, other';

COMMENT ON COLUMN daf_documents.ai_confidence IS
  'Confidence score of AI detection (0.000 to 1.000)';

COMMENT ON COLUMN daf_documents.page_count IS
  'Number of pages in the document';

COMMENT ON COLUMN daf_documents.table_count IS
  'Number of tables detected in the document';

COMMENT ON COLUMN daf_documents.full_text IS
  'Full extracted text content for search and RAG';

COMMENT ON COLUMN daf_documents.key_info IS
  'Type-specific key information for adaptive display. Examples:
   - Invoice: {"supplier": "EDF", "amount": 412.50, "date": "2025-01-24"}
   - CV: {"name": "Jean Martin", "title": "Développeur", "skills": ["React", "Node"]}
   - Contract: {"parties": ["A", "B"], "type": "Service", "renewal_date": "2026-02"}
   - Other: {"summary": "Document description"}';

-- Index for AI detected type filtering
CREATE INDEX IF NOT EXISTS idx_daf_docs_ai_type
  ON daf_documents(org_id, ai_detected_type);

-- Full-text search index on full_text column
CREATE INDEX IF NOT EXISTS idx_daf_docs_fulltext_search
  ON daf_documents USING GIN(to_tsvector('french', COALESCE(full_text, '')));

-- =====================================================
-- Update stats function to include all document types
-- =====================================================

CREATE OR REPLACE FUNCTION get_daf_stats_v2(p_org_id UUID)
RETURNS TABLE(
  total_documents BIGINT,
  -- By AI-detected type
  total_invoices BIGINT,
  total_cvs BIGINT,
  total_contracts BIGINT,
  total_reports BIGINT,
  total_other BIGINT,
  -- By status
  total_validated BIGINT,
  total_pending BIGINT,
  total_extracted BIGINT,
  -- Financial (invoices only)
  montant_total_ttc NUMERIC,
  nombre_fournisseurs BIGINT,
  -- Attention needed
  needs_attention BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_documents,
    -- By AI type
    COUNT(*) FILTER (WHERE ai_detected_type = 'invoice' OR doc_type = 'facture') as total_invoices,
    COUNT(*) FILTER (WHERE ai_detected_type = 'cv') as total_cvs,
    COUNT(*) FILTER (WHERE ai_detected_type = 'contract' OR doc_type = 'contrat') as total_contracts,
    COUNT(*) FILTER (WHERE ai_detected_type = 'report') as total_reports,
    COUNT(*) FILTER (WHERE ai_detected_type = 'other' OR ai_detected_type IS NULL) as total_other,
    -- By status
    COUNT(*) FILTER (WHERE status = 'validated') as total_validated,
    COUNT(*) FILTER (WHERE status IN ('uploaded', 'extracted')) as total_pending,
    COUNT(*) FILTER (WHERE status = 'extracted') as total_extracted,
    -- Financial
    COALESCE(SUM(montant_ttc), 0) as montant_total_ttc,
    COUNT(DISTINCT fournisseur) as nombre_fournisseurs,
    -- Needs attention: documents without extraction or with low confidence
    COUNT(*) FILTER (
      WHERE status = 'uploaded'
      OR (ai_confidence IS NOT NULL AND ai_confidence < 0.5)
    ) as needs_attention
  FROM daf_documents
  WHERE org_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to the new function
GRANT EXECUTE ON FUNCTION get_daf_stats_v2(UUID) TO authenticated;
