-- Migration: Add additional supplier fields
-- Date: 2025-11-26

-- Add code (vendor code for quick search)
ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS code VARCHAR(20);

-- Add company_name if not exists
ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);

-- Add address as text (for display purposes, in addition to JSONB address field)
ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS address TEXT;

-- Add city
ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS city VARCHAR(100);

-- Add postal_code
ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);

-- Add vat_code (France, Exonéré France, Intracommunautaire, Import)
ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS vat_code VARCHAR(50);

-- Index for code search
CREATE INDEX IF NOT EXISTS idx_erp_suppliers_code ON erp_suppliers(org_id, code);

-- Comments
COMMENT ON COLUMN erp_suppliers.code IS 'Code fournisseur (ex: F001, FOUR-123)';
COMMENT ON COLUMN erp_suppliers.company_name IS 'Raison sociale du fournisseur';
COMMENT ON COLUMN erp_suppliers.address IS 'Adresse complète';
COMMENT ON COLUMN erp_suppliers.city IS 'Ville';
COMMENT ON COLUMN erp_suppliers.postal_code IS 'Code postal';
COMMENT ON COLUMN erp_suppliers.vat_code IS 'Code TVA (france, exonere_france, intracommunautaire, import)';
