-- =============================================================================
-- MINI-ERP SCHEMA
-- Smart Mini-ERP for small businesses (1-10 employees)
-- Supports FR (PCG) and US (Chart of Accounts)
-- =============================================================================

-- =============================================================================
-- A. ENTITÉS DE BASE
-- =============================================================================

-- 1. Clients (Customers)
CREATE TABLE IF NOT EXISTS erp_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Basic info
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  company_name VARCHAR(255),

  -- Tax info
  vat_number VARCHAR(50),
  siret VARCHAR(20), -- FR specific
  ein VARCHAR(20), -- US specific (Employer Identification Number)

  -- Addresses
  billing_address JSONB, -- {street, city, postal_code, country, state}
  shipping_address JSONB,

  -- Metadata
  category VARCHAR(100),
  tags TEXT[],
  notes TEXT,
  currency VARCHAR(3) DEFAULT 'EUR',
  payment_terms INTEGER DEFAULT 30, -- Days

  -- Stats (denormalized for performance)
  total_invoiced DECIMAL(12,2) DEFAULT 0,
  total_paid DECIMAL(12,2) DEFAULT 0,
  total_outstanding DECIMAL(12,2) DEFAULT 0,
  invoice_count INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2. Suppliers (Fournisseurs)
CREATE TABLE IF NOT EXISTS erp_suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Basic info
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(255),

  -- Tax info
  vat_number VARCHAR(50),
  siret VARCHAR(20),
  ein VARCHAR(20),

  -- Address
  address JSONB,
  country VARCHAR(2) DEFAULT 'FR',

  -- Categorization
  category VARCHAR(100),
  tags TEXT[],
  notes TEXT,

  -- Payment info
  currency VARCHAR(3) DEFAULT 'EUR',
  payment_terms INTEGER DEFAULT 30,
  bank_details JSONB, -- {iban, bic, account_name}

  -- Stats
  total_purchased DECIMAL(12,2) DEFAULT 0,
  total_paid DECIMAL(12,2) DEFAULT 0,
  total_outstanding DECIMAL(12,2) DEFAULT 0,
  invoice_count INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 3. Products / Services
CREATE TABLE IF NOT EXISTS erp_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Basic info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sku VARCHAR(100), -- Stock Keeping Unit

  -- Pricing
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'EUR',

  -- Tax
  vat_rate DECIMAL(5,2) DEFAULT 20.00, -- 20% default for FR
  tax_category VARCHAR(50) DEFAULT 'standard', -- standard, reduced, exempt

  -- Type
  product_type VARCHAR(20) DEFAULT 'service' CHECK (product_type IN ('product', 'service')),
  category VARCHAR(100),

  -- Accounting
  revenue_account_code VARCHAR(20), -- 706 for services in PCG
  expense_account_code VARCHAR(20),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- B. VENTES (SALES)
-- =============================================================================

-- 4. Estimates (Devis)
CREATE TABLE IF NOT EXISTS erp_estimates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES erp_clients(id) ON DELETE SET NULL,

  -- Numbering
  estimate_number VARCHAR(50) NOT NULL,
  reference VARCHAR(100),

  -- Dates
  estimate_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,

  -- Status
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted')),

  -- Amounts
  subtotal_ht DECIMAL(12,2) DEFAULT 0,
  total_vat DECIMAL(12,2) DEFAULT 0,
  total_ttc DECIMAL(12,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'EUR',

  -- Discount
  discount_type VARCHAR(10) DEFAULT 'percent' CHECK (discount_type IN ('percent', 'amount')),
  discount_value DECIMAL(12,2) DEFAULT 0,

  -- Notes
  notes TEXT,
  terms TEXT,

  -- Converted to invoice
  converted_to_invoice_id UUID,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 5. Invoices (Factures clients)
CREATE TABLE IF NOT EXISTS erp_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES erp_clients(id) ON DELETE SET NULL,
  estimate_id UUID REFERENCES erp_estimates(id) ON DELETE SET NULL,

  -- Numbering
  invoice_number VARCHAR(50) NOT NULL,
  reference VARCHAR(100),

  -- Dates
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,

  -- Status
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled', 'refunded')),

  -- Amounts
  subtotal_ht DECIMAL(12,2) DEFAULT 0,
  total_vat DECIMAL(12,2) DEFAULT 0,
  total_ttc DECIMAL(12,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'EUR',

  -- Payment tracking
  paid_amount DECIMAL(12,2) DEFAULT 0,
  balance_due DECIMAL(12,2) DEFAULT 0,

  -- Discount
  discount_type VARCHAR(10) DEFAULT 'percent' CHECK (discount_type IN ('percent', 'amount')),
  discount_value DECIMAL(12,2) DEFAULT 0,

  -- Notes
  notes TEXT,
  payment_terms TEXT,
  footer TEXT,

  -- PDF
  pdf_url TEXT,

  -- Accounting
  journal_entry_id UUID,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 6. Invoice Lines
CREATE TABLE IF NOT EXISTS erp_invoice_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES erp_invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES erp_products(id) ON DELETE SET NULL,

  -- Line details
  description TEXT NOT NULL,
  quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,

  -- Tax
  vat_rate DECIMAL(5,2) DEFAULT 20.00,

  -- Calculated
  total_ht DECIMAL(12,2) NOT NULL,
  total_vat DECIMAL(12,2) NOT NULL,
  total_ttc DECIMAL(12,2) NOT NULL,

  -- Ordering
  line_order INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Estimate Lines
CREATE TABLE IF NOT EXISTS erp_estimate_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  estimate_id UUID NOT NULL REFERENCES erp_estimates(id) ON DELETE CASCADE,
  product_id UUID REFERENCES erp_products(id) ON DELETE SET NULL,

  description TEXT NOT NULL,
  quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  vat_rate DECIMAL(5,2) DEFAULT 20.00,

  total_ht DECIMAL(12,2) NOT NULL,
  total_vat DECIMAL(12,2) NOT NULL,
  total_ttc DECIMAL(12,2) NOT NULL,

  line_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Payments (Paiements reçus)
CREATE TABLE IF NOT EXISTS erp_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES erp_invoices(id) ON DELETE SET NULL,
  client_id UUID REFERENCES erp_clients(id) ON DELETE SET NULL,

  -- Payment details
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Method
  payment_method VARCHAR(30) DEFAULT 'bank_transfer' CHECK (payment_method IN ('cash', 'check', 'bank_transfer', 'card', 'paypal', 'stripe', 'other')),
  reference VARCHAR(100),

  -- Notes
  notes TEXT,

  -- Accounting
  journal_entry_id UUID,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- =============================================================================
-- C. ACHATS (PURCHASES)
-- =============================================================================

-- 9. Supplier Invoices (Factures fournisseurs)
CREATE TABLE IF NOT EXISTS erp_supplier_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES erp_suppliers(id) ON DELETE SET NULL,

  -- Link to DAF document if OCR'd
  daf_document_id UUID,

  -- Invoice info
  invoice_number VARCHAR(100),
  reference VARCHAR(100),

  -- Dates
  invoice_date DATE,
  due_date DATE,
  received_date DATE DEFAULT CURRENT_DATE,

  -- Status
  status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('draft', 'unpaid', 'partial', 'paid', 'overdue', 'disputed')),

  -- Amounts
  subtotal_ht DECIMAL(12,2) DEFAULT 0,
  total_vat DECIMAL(12,2) DEFAULT 0,
  total_ttc DECIMAL(12,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'EUR',

  -- Payment tracking
  paid_amount DECIMAL(12,2) DEFAULT 0,
  balance_due DECIMAL(12,2) DEFAULT 0,

  -- Document
  document_url TEXT,

  -- Notes
  notes TEXT,

  -- Accounting
  journal_entry_id UUID,
  expense_category VARCHAR(100),
  account_code VARCHAR(20), -- PCG account (6xx)

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 10. Supplier Invoice Lines
CREATE TABLE IF NOT EXISTS erp_supplier_invoice_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_invoice_id UUID NOT NULL REFERENCES erp_supplier_invoices(id) ON DELETE CASCADE,

  description TEXT NOT NULL,
  quantity DECIMAL(10,3) DEFAULT 1,
  unit_price DECIMAL(12,2),
  vat_rate DECIMAL(5,2) DEFAULT 20.00,

  total_ht DECIMAL(12,2) NOT NULL,
  total_vat DECIMAL(12,2) DEFAULT 0,
  total_ttc DECIMAL(12,2) NOT NULL,

  -- Accounting
  account_code VARCHAR(20), -- PCG account

  line_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Expenses (Dépenses hors factures)
CREATE TABLE IF NOT EXISTS erp_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES erp_suppliers(id) ON DELETE SET NULL,

  -- Details
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Categorization
  category VARCHAR(100),
  subcategory VARCHAR(100),

  -- Payment
  payment_method VARCHAR(30) DEFAULT 'card',
  is_paid BOOLEAN DEFAULT TRUE,

  -- Tax
  vat_amount DECIMAL(12,2) DEFAULT 0,
  is_deductible BOOLEAN DEFAULT TRUE,

  -- Receipt
  receipt_url TEXT,

  -- Accounting
  account_code VARCHAR(20),
  journal_entry_id UUID,

  -- Status
  status VARCHAR(20) DEFAULT 'validated' CHECK (status IN ('pending', 'validated', 'rejected', 'reimbursed')),

  -- Recurring
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern VARCHAR(20), -- monthly, weekly, yearly

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 12. Expense Receipts / Notes de frais
CREATE TABLE IF NOT EXISTS erp_expense_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Details
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  expense_date DATE NOT NULL,

  -- Category
  category VARCHAR(100),

  -- Receipt
  receipt_url TEXT,

  -- Approval workflow
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'reimbursed')),
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,

  -- Reimbursement
  reimbursed_at TIMESTAMP WITH TIME ZONE,
  reimbursement_reference VARCHAR(100),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- D. COMPTABILITÉ SIMPLIFIÉE
-- =============================================================================

-- 13. Chart of Accounts (Plan comptable)
CREATE TABLE IF NOT EXISTS erp_chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Account info
  code VARCHAR(20) NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT,

  -- Classification
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  category VARCHAR(100),

  -- Hierarchy
  parent_code VARCHAR(20),
  level INTEGER DEFAULT 1,

  -- Standard
  accounting_standard VARCHAR(10) DEFAULT 'PCG' CHECK (accounting_standard IN ('PCG', 'GAAP')), -- PCG for France, GAAP for US

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE, -- System accounts can't be deleted

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(org_id, code)
);

-- 14. Journal Entries (Écritures comptables)
CREATE TABLE IF NOT EXISTS erp_journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Journal
  journal_code VARCHAR(10) NOT NULL DEFAULT 'GEN', -- VE (ventes), AC (achats), BQ (banque), OD (opérations diverses)
  entry_number VARCHAR(50),

  -- Date
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Reference
  reference VARCHAR(100),
  description TEXT,

  -- Totals (must balance)
  total_debit DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_credit DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Source
  source_type VARCHAR(30), -- invoice, supplier_invoice, payment, expense, manual
  source_id UUID,

  -- Status
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
  posted_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 15. Journal Lines (Lignes d'écritures)
CREATE TABLE IF NOT EXISTS erp_journal_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id UUID NOT NULL REFERENCES erp_journal_entries(id) ON DELETE CASCADE,

  -- Account
  account_code VARCHAR(20) NOT NULL,

  -- Amounts (one must be 0)
  debit DECIMAL(12,2) DEFAULT 0,
  credit DECIMAL(12,2) DEFAULT 0,

  -- Details
  description TEXT,

  -- Third party
  client_id UUID REFERENCES erp_clients(id),
  supplier_id UUID REFERENCES erp_suppliers(id),

  -- Ordering
  line_order INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- E. CONFIGURATION ERP
-- =============================================================================

-- 16. ERP Settings (Configuration par organisation)
CREATE TABLE IF NOT EXISTS erp_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,

  -- Company info
  company_name VARCHAR(255),
  legal_name VARCHAR(255),
  vat_number VARCHAR(50),
  siret VARCHAR(20),
  ein VARCHAR(20),

  -- Address
  address JSONB,

  -- Banking
  bank_details JSONB,

  -- Numbering
  invoice_prefix VARCHAR(20) DEFAULT 'INV-',
  invoice_next_number INTEGER DEFAULT 1,
  estimate_prefix VARCHAR(20) DEFAULT 'EST-',
  estimate_next_number INTEGER DEFAULT 1,

  -- Defaults
  default_currency VARCHAR(3) DEFAULT 'EUR',
  default_vat_rate DECIMAL(5,2) DEFAULT 20.00,
  default_payment_terms INTEGER DEFAULT 30,

  -- Accounting
  accounting_standard VARCHAR(10) DEFAULT 'PCG',
  fiscal_year_start INTEGER DEFAULT 1, -- Month (1 = January)

  -- Localization
  country VARCHAR(2) DEFAULT 'FR',
  language VARCHAR(5) DEFAULT 'fr',
  date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',

  -- Features
  enable_estimates BOOLEAN DEFAULT TRUE,
  enable_expense_receipts BOOLEAN DEFAULT TRUE,
  enable_auto_accounting BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Clients
CREATE INDEX IF NOT EXISTS idx_erp_clients_org ON erp_clients(org_id);
CREATE INDEX IF NOT EXISTS idx_erp_clients_name ON erp_clients(org_id, name);

-- Suppliers
CREATE INDEX IF NOT EXISTS idx_erp_suppliers_org ON erp_suppliers(org_id);
CREATE INDEX IF NOT EXISTS idx_erp_suppliers_name ON erp_suppliers(org_id, name);

-- Products
CREATE INDEX IF NOT EXISTS idx_erp_products_org ON erp_products(org_id);

-- Estimates
CREATE INDEX IF NOT EXISTS idx_erp_estimates_org ON erp_estimates(org_id);
CREATE INDEX IF NOT EXISTS idx_erp_estimates_client ON erp_estimates(client_id);
CREATE INDEX IF NOT EXISTS idx_erp_estimates_status ON erp_estimates(org_id, status);

-- Invoices
CREATE INDEX IF NOT EXISTS idx_erp_invoices_org ON erp_invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_erp_invoices_client ON erp_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_erp_invoices_status ON erp_invoices(org_id, status);
CREATE INDEX IF NOT EXISTS idx_erp_invoices_date ON erp_invoices(org_id, invoice_date);
CREATE INDEX IF NOT EXISTS idx_erp_invoices_due ON erp_invoices(org_id, due_date);

-- Payments
CREATE INDEX IF NOT EXISTS idx_erp_payments_org ON erp_payments(org_id);
CREATE INDEX IF NOT EXISTS idx_erp_payments_invoice ON erp_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_erp_payments_date ON erp_payments(org_id, payment_date);

-- Supplier Invoices
CREATE INDEX IF NOT EXISTS idx_erp_supplier_invoices_org ON erp_supplier_invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_erp_supplier_invoices_supplier ON erp_supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_erp_supplier_invoices_status ON erp_supplier_invoices(org_id, status);

-- Expenses
CREATE INDEX IF NOT EXISTS idx_erp_expenses_org ON erp_expenses(org_id);
CREATE INDEX IF NOT EXISTS idx_erp_expenses_date ON erp_expenses(org_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_erp_expenses_category ON erp_expenses(org_id, category);

-- Journal Entries
CREATE INDEX IF NOT EXISTS idx_erp_journal_entries_org ON erp_journal_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_erp_journal_entries_date ON erp_journal_entries(org_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_erp_journal_entries_source ON erp_journal_entries(source_type, source_id);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE erp_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_estimate_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_supplier_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_expense_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for org-scoped tables
DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'erp_clients', 'erp_suppliers', 'erp_products',
    'erp_estimates', 'erp_invoices', 'erp_payments',
    'erp_supplier_invoices', 'erp_expenses', 'erp_expense_receipts',
    'erp_chart_of_accounts', 'erp_journal_entries', 'erp_settings'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    -- Select policy
    EXECUTE format('
      CREATE POLICY %I_select ON %I FOR SELECT
      USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()))
    ', t || '_policy', t);

    -- Insert policy
    EXECUTE format('
      CREATE POLICY %I_insert ON %I FOR INSERT
      WITH CHECK (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()))
    ', t || '_insert', t);

    -- Update policy
    EXECUTE format('
      CREATE POLICY %I_update ON %I FOR UPDATE
      USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()))
    ', t || '_update', t);

    -- Delete policy
    EXECUTE format('
      CREATE POLICY %I_delete ON %I FOR DELETE
      USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid() AND role IN (''org_admin'', ''org_manager'')))
    ', t || '_delete', t);
  END LOOP;
END $$;

-- Line tables policies (via parent)
CREATE POLICY erp_estimate_lines_select ON erp_estimate_lines FOR SELECT
USING (estimate_id IN (SELECT id FROM erp_estimates WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())));

CREATE POLICY erp_estimate_lines_insert ON erp_estimate_lines FOR INSERT
WITH CHECK (estimate_id IN (SELECT id FROM erp_estimates WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())));

CREATE POLICY erp_estimate_lines_update ON erp_estimate_lines FOR UPDATE
USING (estimate_id IN (SELECT id FROM erp_estimates WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())));

CREATE POLICY erp_estimate_lines_delete ON erp_estimate_lines FOR DELETE
USING (estimate_id IN (SELECT id FROM erp_estimates WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())));

CREATE POLICY erp_invoice_lines_select ON erp_invoice_lines FOR SELECT
USING (invoice_id IN (SELECT id FROM erp_invoices WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())));

CREATE POLICY erp_invoice_lines_insert ON erp_invoice_lines FOR INSERT
WITH CHECK (invoice_id IN (SELECT id FROM erp_invoices WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())));

CREATE POLICY erp_invoice_lines_update ON erp_invoice_lines FOR UPDATE
USING (invoice_id IN (SELECT id FROM erp_invoices WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())));

CREATE POLICY erp_invoice_lines_delete ON erp_invoice_lines FOR DELETE
USING (invoice_id IN (SELECT id FROM erp_invoices WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())));

CREATE POLICY erp_supplier_invoice_lines_select ON erp_supplier_invoice_lines FOR SELECT
USING (supplier_invoice_id IN (SELECT id FROM erp_supplier_invoices WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())));

CREATE POLICY erp_supplier_invoice_lines_insert ON erp_supplier_invoice_lines FOR INSERT
WITH CHECK (supplier_invoice_id IN (SELECT id FROM erp_supplier_invoices WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())));

CREATE POLICY erp_supplier_invoice_lines_update ON erp_supplier_invoice_lines FOR UPDATE
USING (supplier_invoice_id IN (SELECT id FROM erp_supplier_invoices WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())));

CREATE POLICY erp_supplier_invoice_lines_delete ON erp_supplier_invoice_lines FOR DELETE
USING (supplier_invoice_id IN (SELECT id FROM erp_supplier_invoices WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())));

CREATE POLICY erp_journal_lines_select ON erp_journal_lines FOR SELECT
USING (entry_id IN (SELECT id FROM erp_journal_entries WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())));

CREATE POLICY erp_journal_lines_insert ON erp_journal_lines FOR INSERT
WITH CHECK (entry_id IN (SELECT id FROM erp_journal_entries WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())));

CREATE POLICY erp_journal_lines_update ON erp_journal_lines FOR UPDATE
USING (entry_id IN (SELECT id FROM erp_journal_entries WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())));

CREATE POLICY erp_journal_lines_delete ON erp_journal_lines FOR DELETE
USING (entry_id IN (SELECT id FROM erp_journal_entries WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())));

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to update invoice totals from lines
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE erp_invoices
  SET
    subtotal_ht = (SELECT COALESCE(SUM(total_ht), 0) FROM erp_invoice_lines WHERE invoice_id = NEW.invoice_id),
    total_vat = (SELECT COALESCE(SUM(total_vat), 0) FROM erp_invoice_lines WHERE invoice_id = NEW.invoice_id),
    total_ttc = (SELECT COALESCE(SUM(total_ttc), 0) FROM erp_invoice_lines WHERE invoice_id = NEW.invoice_id),
    balance_due = total_ttc - paid_amount,
    updated_at = NOW()
  WHERE id = NEW.invoice_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for invoice lines
DROP TRIGGER IF EXISTS trg_update_invoice_totals ON erp_invoice_lines;
CREATE TRIGGER trg_update_invoice_totals
AFTER INSERT OR UPDATE OR DELETE ON erp_invoice_lines
FOR EACH ROW EXECUTE FUNCTION update_invoice_totals();

-- Function to update estimate totals
CREATE OR REPLACE FUNCTION update_estimate_totals()
RETURNS TRIGGER AS $$
DECLARE
  target_estimate_id UUID;
BEGIN
  target_estimate_id := COALESCE(NEW.estimate_id, OLD.estimate_id);

  UPDATE erp_estimates
  SET
    subtotal_ht = (SELECT COALESCE(SUM(total_ht), 0) FROM erp_estimate_lines WHERE estimate_id = target_estimate_id),
    total_vat = (SELECT COALESCE(SUM(total_vat), 0) FROM erp_estimate_lines WHERE estimate_id = target_estimate_id),
    total_ttc = (SELECT COALESCE(SUM(total_ttc), 0) FROM erp_estimate_lines WHERE estimate_id = target_estimate_id),
    updated_at = NOW()
  WHERE id = target_estimate_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_estimate_totals ON erp_estimate_lines;
CREATE TRIGGER trg_update_estimate_totals
AFTER INSERT OR UPDATE OR DELETE ON erp_estimate_lines
FOR EACH ROW EXECUTE FUNCTION update_estimate_totals();

-- Function to update client stats
CREATE OR REPLACE FUNCTION update_client_stats(p_client_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE erp_clients
  SET
    total_invoiced = (SELECT COALESCE(SUM(total_ttc), 0) FROM erp_invoices WHERE client_id = p_client_id AND status != 'cancelled'),
    total_paid = (SELECT COALESCE(SUM(paid_amount), 0) FROM erp_invoices WHERE client_id = p_client_id AND status != 'cancelled'),
    total_outstanding = (SELECT COALESCE(SUM(balance_due), 0) FROM erp_invoices WHERE client_id = p_client_id AND status IN ('sent', 'partial', 'overdue')),
    invoice_count = (SELECT COUNT(*) FROM erp_invoices WHERE client_id = p_client_id AND status != 'cancelled'),
    updated_at = NOW()
  WHERE id = p_client_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update supplier stats
CREATE OR REPLACE FUNCTION update_supplier_stats(p_supplier_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE erp_suppliers
  SET
    total_purchased = (SELECT COALESCE(SUM(total_ttc), 0) FROM erp_supplier_invoices WHERE supplier_id = p_supplier_id),
    total_paid = (SELECT COALESCE(SUM(paid_amount), 0) FROM erp_supplier_invoices WHERE supplier_id = p_supplier_id),
    total_outstanding = (SELECT COALESCE(SUM(balance_due), 0) FROM erp_supplier_invoices WHERE supplier_id = p_supplier_id AND status IN ('unpaid', 'partial', 'overdue')),
    invoice_count = (SELECT COUNT(*) FROM erp_supplier_invoices WHERE supplier_id = p_supplier_id),
    updated_at = NOW()
  WHERE id = p_supplier_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get next invoice number
CREATE OR REPLACE FUNCTION get_next_invoice_number(p_org_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_next_num INTEGER;
  v_result TEXT;
BEGIN
  SELECT invoice_prefix, invoice_next_number
  INTO v_prefix, v_next_num
  FROM erp_settings
  WHERE org_id = p_org_id;

  IF v_prefix IS NULL THEN
    v_prefix := 'INV-';
    v_next_num := 1;
  END IF;

  v_result := v_prefix || LPAD(v_next_num::TEXT, 5, '0');

  UPDATE erp_settings
  SET invoice_next_number = v_next_num + 1
  WHERE org_id = p_org_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- DEFAULT CHART OF ACCOUNTS (PCG French)
-- =============================================================================

-- Insert default PCG accounts function
CREATE OR REPLACE FUNCTION init_pcg_accounts(p_org_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Only insert if no accounts exist
  IF NOT EXISTS (SELECT 1 FROM erp_chart_of_accounts WHERE org_id = p_org_id) THEN
    INSERT INTO erp_chart_of_accounts (org_id, code, label, account_type, category, is_system, accounting_standard) VALUES
    -- Class 1: Capital
    (p_org_id, '101', 'Capital social', 'equity', 'capital', true, 'PCG'),
    (p_org_id, '120', 'Résultat de l''exercice', 'equity', 'capital', true, 'PCG'),

    -- Class 2: Immobilisations
    (p_org_id, '215', 'Matériel industriel', 'asset', 'fixed_assets', true, 'PCG'),
    (p_org_id, '218', 'Autres immobilisations corporelles', 'asset', 'fixed_assets', true, 'PCG'),

    -- Class 4: Tiers
    (p_org_id, '401', 'Fournisseurs', 'liability', 'payables', true, 'PCG'),
    (p_org_id, '411', 'Clients', 'asset', 'receivables', true, 'PCG'),
    (p_org_id, '445', 'TVA', 'liability', 'taxes', true, 'PCG'),
    (p_org_id, '4456', 'TVA déductible', 'asset', 'taxes', true, 'PCG'),
    (p_org_id, '4457', 'TVA collectée', 'liability', 'taxes', true, 'PCG'),

    -- Class 5: Financier
    (p_org_id, '512', 'Banque', 'asset', 'bank', true, 'PCG'),
    (p_org_id, '530', 'Caisse', 'asset', 'cash', true, 'PCG'),

    -- Class 6: Charges
    (p_org_id, '601', 'Achats de matières premières', 'expense', 'purchases', true, 'PCG'),
    (p_org_id, '602', 'Achats stockés', 'expense', 'purchases', true, 'PCG'),
    (p_org_id, '604', 'Achats d''études et prestations', 'expense', 'purchases', true, 'PCG'),
    (p_org_id, '606', 'Achats non stockés', 'expense', 'purchases', true, 'PCG'),
    (p_org_id, '607', 'Achats de marchandises', 'expense', 'purchases', true, 'PCG'),
    (p_org_id, '611', 'Sous-traitance générale', 'expense', 'services', true, 'PCG'),
    (p_org_id, '613', 'Locations', 'expense', 'services', true, 'PCG'),
    (p_org_id, '615', 'Entretien et réparations', 'expense', 'services', true, 'PCG'),
    (p_org_id, '616', 'Primes d''assurances', 'expense', 'services', true, 'PCG'),
    (p_org_id, '622', 'Rémunérations d''intermédiaires', 'expense', 'services', true, 'PCG'),
    (p_org_id, '623', 'Publicité', 'expense', 'marketing', true, 'PCG'),
    (p_org_id, '625', 'Déplacements, missions et réceptions', 'expense', 'travel', true, 'PCG'),
    (p_org_id, '626', 'Frais postaux et télécom', 'expense', 'communication', true, 'PCG'),
    (p_org_id, '627', 'Services bancaires', 'expense', 'bank_fees', true, 'PCG'),
    (p_org_id, '628', 'Divers', 'expense', 'other', true, 'PCG'),
    (p_org_id, '641', 'Rémunérations du personnel', 'expense', 'salaries', true, 'PCG'),
    (p_org_id, '645', 'Charges de sécurité sociale', 'expense', 'social_charges', true, 'PCG'),

    -- Class 7: Produits
    (p_org_id, '701', 'Ventes de produits finis', 'revenue', 'sales', true, 'PCG'),
    (p_org_id, '706', 'Prestations de services', 'revenue', 'services', true, 'PCG'),
    (p_org_id, '707', 'Ventes de marchandises', 'revenue', 'sales', true, 'PCG'),
    (p_org_id, '708', 'Produits des activités annexes', 'revenue', 'other', true, 'PCG');
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE erp_clients IS 'Customer/Client entities for invoicing';
COMMENT ON TABLE erp_suppliers IS 'Supplier/Vendor entities for purchases';
COMMENT ON TABLE erp_invoices IS 'Sales invoices issued to clients';
COMMENT ON TABLE erp_supplier_invoices IS 'Purchase invoices from suppliers';
COMMENT ON TABLE erp_journal_entries IS 'Accounting journal entries';
