-- =====================================================
-- Migration: Add missing document types (Quotation, Credit Note)
-- Date: 2024-11-28
--
-- Current doc_type values: facture, releve_bancaire, contrat, assurance, note_frais, autre
-- Adding: devis (quotation), avoir (credit note)
-- =====================================================

-- Update the comment on doc_type to reflect new types
COMMENT ON COLUMN daf_documents.doc_type IS
  'Types: facture, devis, avoir, releve_bancaire, contrat, assurance, note_frais, autre';

-- Create an enum type for better validation (optional but recommended)
DO $$ BEGIN
  CREATE TYPE document_type_enum AS ENUM (
    'facture',        -- Invoice
    'devis',          -- Quotation/Quote
    'avoir',          -- Credit Note
    'releve_bancaire', -- Bank Statement
    'contrat',        -- Contract
    'assurance',      -- Insurance
    'note_frais',     -- Expense Report
    'autre'           -- Other
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add English document type column for API/frontend consistency
ALTER TABLE daf_documents
ADD COLUMN IF NOT EXISTS document_type VARCHAR(50);

-- Update the English document_type based on French doc_type
UPDATE daf_documents SET document_type =
  CASE doc_type
    WHEN 'facture' THEN 'INVOICE'
    WHEN 'devis' THEN 'QUOTATION'
    WHEN 'avoir' THEN 'CREDIT_NOTE'
    WHEN 'releve_bancaire' THEN 'BANK_STATEMENT'
    WHEN 'contrat' THEN 'CONTRACT'
    WHEN 'assurance' THEN 'INSURANCE'
    WHEN 'note_frais' THEN 'EXPENSE_REPORT'
    ELSE 'OTHER'
  END
WHERE document_type IS NULL;

-- Add classification confidence column
ALTER TABLE daf_documents
ADD COLUMN IF NOT EXISTS classification_confidence NUMERIC(5,4);

COMMENT ON COLUMN daf_documents.document_type IS
  'English document types: INVOICE, QUOTATION, CREDIT_NOTE, BANK_STATEMENT, CONTRACT, INSURANCE, EXPENSE_REPORT, OTHER';

COMMENT ON COLUMN daf_documents.classification_confidence IS
  'AI classification confidence score (0.0 to 1.0)';

-- Create index on the new document_type column
CREATE INDEX IF NOT EXISTS idx_daf_docs_document_type
  ON daf_documents(org_id, document_type);

-- =====================================================
-- Add document_type to the invoices table (for legacy compatibility)
-- =====================================================

-- Check if invoices table exists and add doc_type
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    -- Add document_type column to invoices table
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) DEFAULT 'INVOICE';

    -- Add classification_confidence
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS classification_confidence NUMERIC(5,4);

    COMMENT ON COLUMN invoices.document_type IS
      'Document types: INVOICE, QUOTATION, CREDIT_NOTE';
  END IF;
END $$;

-- =====================================================
-- Update the stats function to include quotations
-- =====================================================

-- Drop existing function first (required when changing return type)
DROP FUNCTION IF EXISTS get_daf_stats_v2(UUID);

CREATE OR REPLACE FUNCTION get_daf_stats_v2(p_org_id UUID)
RETURNS TABLE (
  total_documents BIGINT,
  total_invoices BIGINT,
  total_quotations BIGINT,
  total_credit_notes BIGINT,
  total_contracts BIGINT,
  total_other BIGINT,
  total_validated BIGINT,
  total_pending BIGINT,
  montant_total_ttc NUMERIC,
  nombre_fournisseurs BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_documents,
    COUNT(*) FILTER (WHERE document_type = 'INVOICE' OR doc_type = 'facture') as total_invoices,
    COUNT(*) FILTER (WHERE document_type = 'QUOTATION' OR doc_type = 'devis') as total_quotations,
    COUNT(*) FILTER (WHERE document_type = 'CREDIT_NOTE' OR doc_type = 'avoir') as total_credit_notes,
    COUNT(*) FILTER (WHERE document_type = 'CONTRACT' OR doc_type = 'contrat') as total_contracts,
    COUNT(*) FILTER (WHERE document_type IN ('OTHER', 'INSURANCE', 'EXPENSE_REPORT', 'BANK_STATEMENT')
                        OR doc_type IN ('autre', 'assurance', 'note_frais', 'releve_bancaire')) as total_other,
    COUNT(*) FILTER (WHERE status = 'validated') as total_validated,
    COUNT(*) FILTER (WHERE status IN ('uploaded', 'extracted')) as total_pending,
    COALESCE(SUM(montant_ttc), 0) as montant_total_ttc,
    COUNT(DISTINCT fournisseur) as nombre_fournisseurs
  FROM daf_documents
  WHERE org_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_daf_stats_v2(UUID) TO authenticated;
