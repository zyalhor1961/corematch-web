-- Quotes (Devis) Module
-- Migration: 20251127200000_quotes.sql

-- =====================================================
-- 1. Quotes table (similar to invoices but for quotes)
-- =====================================================

CREATE TABLE IF NOT EXISTS quotes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,

    -- Quote identification
    quote_number text NOT NULL,
    reference text,

    -- Client information
    client_id uuid REFERENCES erp_clients(id) ON DELETE SET NULL,
    client_name text,
    client_email text,
    client_address text,

    -- Lead reference (if imported from CRM)
    lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,

    -- Dates
    quote_date date NOT NULL DEFAULT CURRENT_DATE,
    validity_date date, -- Date until which the quote is valid

    -- Status
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted')),

    -- Amounts (calculated from lines)
    total_ht numeric(12,2) DEFAULT 0,
    total_vat numeric(12,2) DEFAULT 0,
    total_ttc numeric(12,2) DEFAULT 0,
    currency text DEFAULT 'EUR',

    -- Conditions
    payment_terms text,
    notes text,

    -- Conversion tracking
    converted_to_invoice_id uuid,
    converted_at timestamp with time zone,

    -- Timestamps
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- =====================================================
-- 2. Quote lines table
-- =====================================================

CREATE TABLE IF NOT EXISTS quote_lines (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE,

    -- Product reference (optional)
    product_id uuid REFERENCES erp_products(id) ON DELETE SET NULL,

    -- Line details
    description text NOT NULL,
    quantity numeric(10,3) DEFAULT 1,
    unit_price numeric(12,2) DEFAULT 0,
    vat_rate numeric(5,2) DEFAULT 20,
    discount_percent numeric(5,2) DEFAULT 0,

    -- Calculated totals
    total_ht numeric(12,2) DEFAULT 0,
    total_vat numeric(12,2) DEFAULT 0,
    total_ttc numeric(12,2) DEFAULT 0,

    -- Ordering
    position int DEFAULT 0,

    created_at timestamp with time zone DEFAULT now()
);

-- =====================================================
-- 3. Indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_quotes_org_id ON quotes(org_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_lead_id ON quotes(lead_id);
CREATE INDEX IF NOT EXISTS idx_quotes_quote_date ON quotes(quote_date DESC);
CREATE INDEX IF NOT EXISTS idx_quote_lines_quote_id ON quote_lines(quote_id);

-- =====================================================
-- 4. Triggers
-- =====================================================

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_quotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quotes_updated_at ON quotes;
CREATE TRIGGER quotes_updated_at
    BEFORE UPDATE ON quotes
    FOR EACH ROW
    EXECUTE FUNCTION update_quotes_updated_at();

-- Trigger to calculate line totals
CREATE OR REPLACE FUNCTION calculate_quote_line_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate line totals with discount
    NEW.total_ht = (NEW.quantity * NEW.unit_price) * (1 - COALESCE(NEW.discount_percent, 0) / 100);
    NEW.total_vat = NEW.total_ht * (NEW.vat_rate / 100);
    NEW.total_ttc = NEW.total_ht + NEW.total_vat;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quote_line_calculate ON quote_lines;
CREATE TRIGGER quote_line_calculate
    BEFORE INSERT OR UPDATE ON quote_lines
    FOR EACH ROW
    EXECUTE FUNCTION calculate_quote_line_totals();

-- Trigger to update quote totals when lines change
CREATE OR REPLACE FUNCTION update_quote_totals()
RETURNS TRIGGER AS $$
DECLARE
    quote_uuid uuid;
BEGIN
    IF TG_OP = 'DELETE' THEN
        quote_uuid := OLD.quote_id;
    ELSE
        quote_uuid := NEW.quote_id;
    END IF;

    UPDATE quotes
    SET
        total_ht = COALESCE((SELECT SUM(total_ht) FROM quote_lines WHERE quote_id = quote_uuid), 0),
        total_vat = COALESCE((SELECT SUM(total_vat) FROM quote_lines WHERE quote_id = quote_uuid), 0),
        total_ttc = COALESCE((SELECT SUM(total_ttc) FROM quote_lines WHERE quote_id = quote_uuid), 0),
        updated_at = now()
    WHERE id = quote_uuid;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quote_lines_update_totals ON quote_lines;
CREATE TRIGGER quote_lines_update_totals
    AFTER INSERT OR UPDATE OR DELETE ON quote_lines
    FOR EACH ROW
    EXECUTE FUNCTION update_quote_totals();

-- =====================================================
-- 5. RLS Policies
-- =====================================================

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quotes_org_access ON quotes;
DROP POLICY IF EXISTS quote_lines_access ON quote_lines;

-- Quotes: Users can only access quotes from their organization
CREATE POLICY quotes_org_access ON quotes
    FOR ALL
    USING (
        org_id IN (
            SELECT om.org_id
            FROM organization_members om
            WHERE om.user_id = auth.uid()
        )
    );

-- Quote lines: Access through quote ownership
CREATE POLICY quote_lines_access ON quote_lines
    FOR ALL
    USING (
        quote_id IN (
            SELECT q.id FROM quotes q
            WHERE q.org_id IN (
                SELECT om.org_id
                FROM organization_members om
                WHERE om.user_id = auth.uid()
            )
        )
    );

-- =====================================================
-- 6. Sequence for quote numbers
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS quote_number_seq START 1;

-- Function to generate quote number
CREATE OR REPLACE FUNCTION generate_quote_number(org_id_param uuid)
RETURNS text AS $$
DECLARE
    year_str text;
    seq_num int;
BEGIN
    year_str := to_char(CURRENT_DATE, 'YYYY');
    seq_num := nextval('quote_number_seq');
    RETURN 'DEV-' || year_str || '-' || LPAD(seq_num::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. Comments
-- =====================================================

COMMENT ON TABLE quotes IS 'Sales quotes (devis) that can be converted to invoices';
COMMENT ON TABLE quote_lines IS 'Line items for quotes';
COMMENT ON COLUMN quotes.lead_id IS 'Reference to CRM lead if quote was created from a lead';
COMMENT ON COLUMN quotes.converted_to_invoice_id IS 'ID of invoice if this quote was converted';
COMMENT ON COLUMN quotes.status IS 'Quote status: draft, sent, accepted, rejected, expired, converted';
