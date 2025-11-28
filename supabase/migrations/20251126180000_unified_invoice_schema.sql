-- =============================================================================
-- UNIFIED INVOICE SCHEMA MIGRATION
-- Merges OCR invoices and ERP invoices into a single system
-- =============================================================================

-- =============================================================================
-- PHASE 1: ADD NEW COLUMNS TO INVOICES TABLE
-- =============================================================================

-- Invoice type: 'inbound' (received) or 'outbound' (sent)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(20) DEFAULT 'inbound';

-- Relationships (for outbound invoices)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES erp_clients(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS estimate_id UUID REFERENCES erp_estimates(id);

-- Relationship (for inbound invoices) - link to supplier
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES erp_suppliers(id);

-- Content fields (from ERP)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reference VARCHAR(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS footer TEXT;

-- Payment tracking (from ERP)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS balance_due NUMERIC(12,2);

-- Discount (from ERP)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_value NUMERIC(12,2);

-- Accounting link
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS journal_entry_id UUID;

-- Audit fields
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- =============================================================================
-- PHASE 2: ADD NEW COLUMNS TO INVOICE_LINES TABLE
-- =============================================================================

-- Product link (for outbound)
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS product_id UUID;

-- Calculated totals (ERP style)
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS amount_ht NUMERIC(12,2);
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS amount_tax NUMERIC(12,2);
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS amount_ttc NUMERIC(12,2);

-- =============================================================================
-- PHASE 3: SET EXISTING DATA AS INBOUND
-- =============================================================================

UPDATE invoices SET invoice_type = 'inbound' WHERE invoice_type IS NULL;

-- =============================================================================
-- PHASE 4: MIGRATE ERP_INVOICES DATA
-- =============================================================================

-- First, drop the unique constraint on invoice_number (will recreate as composite)
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;

-- Create composite unique constraint: invoice_number unique per org + type
ALTER TABLE invoices ADD CONSTRAINT invoices_org_type_number_unique
  UNIQUE (org_id, invoice_type, invoice_number);

-- Insert ERP invoices as 'outbound' type
INSERT INTO invoices (
  id,
  org_id,
  invoice_number,
  invoice_type,
  invoice_date,
  due_date,
  currency,
  status,
  payment_terms,
  subtotal_ht,
  total_tax,
  total_ttc,
  paid_amount,
  balance_due,
  discount_type,
  discount_value,
  client_id,
  estimate_id,
  reference,
  notes,
  footer,
  journal_entry_id,
  file_url,
  created_at,
  updated_at,
  created_by
)
SELECT
  id,
  org_id,
  invoice_number,
  'outbound',
  invoice_date,
  due_date,
  currency,
  status,
  payment_terms,
  subtotal_ht,
  total_vat,
  total_ttc,
  paid_amount,
  balance_due,
  discount_type,
  discount_value,
  client_id,
  estimate_id,
  reference,
  notes,
  footer,
  journal_entry_id,
  pdf_url,
  created_at,
  updated_at,
  created_by
FROM erp_invoices
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PHASE 5: MIGRATE ERP_INVOICE_LINES DATA
-- =============================================================================

INSERT INTO invoice_lines (
  id,
  invoice_id,
  description,
  quantity,
  unit_price,
  tax_rate,
  amount_ht,
  amount_tax,
  amount_ttc,
  product_id,
  line_number,
  created_at
)
SELECT
  id,
  invoice_id,
  description,
  quantity,
  unit_price,
  vat_rate,
  total_ht,
  total_vat,
  total_ttc,
  product_id,
  line_order,
  created_at
FROM erp_invoice_lines
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PHASE 6: UNIFIED STATUS VALUES
-- =============================================================================

-- Normalize status values across both systems
-- ERP statuses: draft, sent, paid, partial, overdue, cancelled
-- OCR statuses: NEEDS_APPROVAL, APPROVED, pending, validated, disputed

-- Create unified status mapping
UPDATE invoices SET status = 'pending' WHERE status = 'NEEDS_APPROVAL';
UPDATE invoices SET status = 'approved' WHERE status = 'APPROVED';
UPDATE invoices SET status = 'approved' WHERE status = 'validated';

-- Add comment documenting valid statuses
COMMENT ON COLUMN invoices.status IS 'Unified statuses: draft, pending, approved, sent, paid, partial, overdue, disputed, cancelled';

-- =============================================================================
-- PHASE 7: CREATE BACKWARD-COMPATIBLE VIEWS
-- =============================================================================

-- Drop existing views if they exist (to recreate)
DROP VIEW IF EXISTS erp_invoices CASCADE;
DROP VIEW IF EXISTS erp_invoice_lines CASCADE;

-- Create erp_invoices view pointing to unified table
CREATE VIEW erp_invoices AS
SELECT
  id,
  org_id,
  client_id,
  estimate_id,
  invoice_number,
  reference,
  invoice_date,
  due_date,
  status,
  subtotal_ht,
  total_tax AS total_vat,  -- Alias for backward compatibility
  total_ttc,
  currency,
  paid_amount,
  balance_due,
  discount_type,
  discount_value,
  notes,
  payment_terms,
  footer,
  file_url AS pdf_url,     -- Alias for backward compatibility
  journal_entry_id,
  created_at,
  updated_at,
  created_by
FROM invoices
WHERE invoice_type = 'outbound';

-- Create erp_invoice_lines view
CREATE VIEW erp_invoice_lines AS
SELECT
  il.id,
  il.invoice_id,
  il.product_id,
  il.description,
  il.quantity,
  il.unit_price,
  il.tax_rate AS vat_rate,      -- Alias for backward compatibility
  il.amount_ht AS total_ht,     -- Alias for backward compatibility
  il.amount_tax AS total_vat,   -- Alias for backward compatibility
  il.amount_ttc AS total_ttc,   -- Alias for backward compatibility
  il.line_number AS line_order, -- Alias for backward compatibility
  il.created_at
FROM invoice_lines il
INNER JOIN invoices i ON il.invoice_id = i.id
WHERE i.invoice_type = 'outbound';

-- =============================================================================
-- PHASE 8: CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_id ON invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- =============================================================================
-- PHASE 9: UPDATE RLS POLICIES
-- =============================================================================

-- Ensure RLS policies work with the unified table
-- (existing policies should already cover org_id filtering)

-- =============================================================================
-- PHASE 10: DROP OLD TABLES (keeping data in views)
-- =============================================================================

-- Drop the original erp tables (data is now in unified invoices)
-- The views provide backward compatibility
DROP TABLE IF EXISTS erp_invoice_lines CASCADE;
DROP TABLE IF EXISTS erp_invoices CASCADE;

-- Drop old RAG chunks table (replaced by dual-path)
DROP TABLE IF EXISTS invoice_chunks CASCADE;

-- =============================================================================
-- PHASE 11: HELPER FUNCTIONS
-- =============================================================================

-- Function to get next invoice number for outbound invoices
CREATE OR REPLACE FUNCTION get_next_outbound_invoice_number(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  last_num TEXT;
  next_seq INT;
BEGIN
  SELECT invoice_number INTO last_num
  FROM invoices
  WHERE org_id = p_org_id AND invoice_type = 'outbound'
  ORDER BY created_at DESC
  LIMIT 1;

  IF last_num IS NULL THEN
    RETURN 'INV-00001';
  END IF;

  -- Extract number and increment
  next_seq := COALESCE(
    (regexp_match(last_num, 'INV-(\d+)'))[1]::INT + 1,
    1
  );

  RETURN 'INV-' || LPAD(next_seq::TEXT, 5, '0');
END;
$$;

-- Function to calculate balance due
CREATE OR REPLACE FUNCTION update_invoice_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.balance_due := COALESCE(NEW.total_ttc, 0) - COALESCE(NEW.paid_amount, 0);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- Trigger to auto-calculate balance
DROP TRIGGER IF EXISTS invoice_balance_trigger ON invoices;
CREATE TRIGGER invoice_balance_trigger
BEFORE INSERT OR UPDATE OF total_ttc, paid_amount ON invoices
FOR EACH ROW
EXECUTE FUNCTION update_invoice_balance();

-- =============================================================================
-- PHASE 12: SUMMARY VIEW FOR ANALYTICS
-- =============================================================================

-- Create unified financial summary view
CREATE OR REPLACE VIEW invoice_analytics AS
SELECT
  org_id,
  invoice_type,
  status,
  COUNT(*) as count,
  SUM(total_ttc) as total_amount,
  SUM(paid_amount) as total_paid,
  SUM(balance_due) as total_outstanding,
  AVG(total_ttc) as avg_amount
FROM invoices
GROUP BY org_id, invoice_type, status;

COMMENT ON VIEW invoice_analytics IS 'Unified invoice analytics across inbound and outbound';

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Final verification query (run manually to check)
-- SELECT invoice_type, COUNT(*), SUM(total_ttc) FROM invoices GROUP BY invoice_type;
