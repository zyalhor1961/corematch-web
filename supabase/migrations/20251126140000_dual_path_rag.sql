-- ============================================================================
-- DUAL-PATH RAG ARCHITECTURE
-- "SQL for Math, Vector for Meaning"
-- ============================================================================

-- Enable pgvector if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 1. INVOICE LINE ITEMS (Hybrid: SQL + Vector)
-- Each line item from the invoice table
-- SQL for prices/quantities, Vector for semantic search on descriptions
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoice_lines (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,

  -- Strict SQL fields for calculations
  description text NOT NULL,
  quantity numeric DEFAULT 1,
  unit_price numeric,
  amount numeric,
  tax_rate numeric,

  -- Line position for ordering
  line_number int,

  -- The Hybrid Magic: Embedding of the description for semantic search
  -- "Find all laptop purchases" even if description says "MacBook Pro 16"
  embedding vector(1536),

  created_at timestamptz DEFAULT now()
);

-- Index for fast invoice lookups
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id ON invoice_lines(invoice_id);

-- Vector index for semantic search on line descriptions
CREATE INDEX IF NOT EXISTS idx_invoice_lines_embedding ON invoice_lines
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- 2. INVOICE CONTEXT CHUNKS (Pure Semantic)
-- For addresses, headers, footers, notes - anything not structured
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoice_context_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,

  -- The text content
  content text NOT NULL,

  -- Chunk metadata
  chunk_type text, -- 'address', 'header', 'footer', 'notes', 'terms'
  page_number int,

  -- Semantic embedding
  embedding vector(1536),

  created_at timestamptz DEFAULT now()
);

-- Index for fast invoice lookups
CREATE INDEX IF NOT EXISTS idx_invoice_context_chunks_invoice_id ON invoice_context_chunks(invoice_id);

-- Vector index for semantic search
CREATE INDEX IF NOT EXISTS idx_invoice_context_chunks_embedding ON invoice_context_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- 3. ENHANCED INVOICES TABLE (Strict SQL)
-- Add missing strict fields if they don't exist
-- ============================================================================

-- Add strict identity fields if missing
DO $$
BEGIN
  -- Vendor identification
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'vendor_siren') THEN
    ALTER TABLE invoices ADD COLUMN vendor_siren text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'vendor_siret') THEN
    ALTER TABLE invoices ADD COLUMN vendor_siret text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'vendor_vat_number') THEN
    ALTER TABLE invoices ADD COLUMN vendor_vat_number text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'vendor_iban') THEN
    ALTER TABLE invoices ADD COLUMN vendor_iban text;
  END IF;

  -- Customer identification
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'customer_name') THEN
    ALTER TABLE invoices ADD COLUMN customer_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'customer_siren') THEN
    ALTER TABLE invoices ADD COLUMN customer_siren text;
  END IF;

  -- Financial strict fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'subtotal_ht') THEN
    ALTER TABLE invoices ADD COLUMN subtotal_ht numeric;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'total_tax') THEN
    ALTER TABLE invoices ADD COLUMN total_tax numeric;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'total_ttc') THEN
    ALTER TABLE invoices ADD COLUMN total_ttc numeric;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'currency') THEN
    ALTER TABLE invoices ADD COLUMN currency text DEFAULT 'EUR';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'payment_terms') THEN
    ALTER TABLE invoices ADD COLUMN payment_terms text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'due_date') THEN
    ALTER TABLE invoices ADD COLUMN due_date date;
  END IF;
END $$;

-- ============================================================================
-- 4. HYBRID SEARCH FUNCTIONS
-- ============================================================================

-- Search line items by semantic similarity
CREATE OR REPLACE FUNCTION search_invoice_lines(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_invoice_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  invoice_id uuid,
  description text,
  quantity numeric,
  unit_price numeric,
  amount numeric,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    il.id,
    il.invoice_id,
    il.description,
    il.quantity,
    il.unit_price,
    il.amount,
    1 - (il.embedding <=> query_embedding) as similarity
  FROM invoice_lines il
  WHERE
    il.embedding IS NOT NULL
    AND 1 - (il.embedding <=> query_embedding) > match_threshold
    AND (filter_invoice_id IS NULL OR il.invoice_id = filter_invoice_id)
  ORDER BY il.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Search context chunks by semantic similarity
CREATE OR REPLACE FUNCTION search_invoice_context(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_invoice_id uuid DEFAULT NULL,
  filter_chunk_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  invoice_id uuid,
  content text,
  chunk_type text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ic.id,
    ic.invoice_id,
    ic.content,
    ic.chunk_type,
    1 - (ic.embedding <=> query_embedding) as similarity
  FROM invoice_context_chunks ic
  WHERE
    ic.embedding IS NOT NULL
    AND 1 - (ic.embedding <=> query_embedding) > match_threshold
    AND (filter_invoice_id IS NULL OR ic.invoice_id = filter_invoice_id)
    AND (filter_chunk_type IS NULL OR ic.chunk_type = filter_chunk_type)
  ORDER BY ic.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- 5. AGGREGATION VIEWS FOR ANALYTICS
-- ============================================================================

-- View for invoice totals with line item verification
CREATE OR REPLACE VIEW invoice_financial_summary AS
SELECT
  i.id,
  i.invoice_number,
  i.vendor_name,
  i.invoice_date,
  i.subtotal_ht as declared_subtotal,
  i.total_tax as declared_tax,
  i.total_ttc as declared_total,
  COALESCE(SUM(il.amount), 0) as calculated_line_total,
  i.total_ttc - COALESCE(SUM(il.amount), 0) as discrepancy
FROM invoices i
LEFT JOIN invoice_lines il ON il.invoice_id = i.id
GROUP BY i.id;

-- View for vendor spending analytics
CREATE OR REPLACE VIEW vendor_spending_analytics AS
SELECT
  vendor_name,
  COUNT(*) as invoice_count,
  SUM(total_ttc) as total_spent,
  AVG(total_ttc) as avg_invoice_amount,
  MIN(invoice_date) as first_invoice,
  MAX(invoice_date) as last_invoice
FROM invoices
WHERE vendor_name IS NOT NULL
GROUP BY vendor_name
ORDER BY total_spent DESC;

COMMENT ON TABLE invoice_lines IS 'Hybrid storage: SQL for calculations, Vector for semantic search on descriptions';
COMMENT ON TABLE invoice_context_chunks IS 'Pure semantic storage for addresses, terms, and unstructured content';
