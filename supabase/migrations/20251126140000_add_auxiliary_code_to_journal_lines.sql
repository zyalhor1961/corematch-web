-- Add auxiliary_code column to erp_journal_lines for supplier/client tiers
-- This allows tracking auxiliary accounts (e.g., F001 for supplier, C001 for client)
-- alongside the general account (e.g., 401000 for suppliers, 411000 for clients)

ALTER TABLE erp_journal_lines
ADD COLUMN IF NOT EXISTS auxiliary_code VARCHAR(20);

-- Add comment to explain the column
COMMENT ON COLUMN erp_journal_lines.auxiliary_code IS 'Code tiers auxiliaire (ex: F001 pour fournisseur, C001 pour client)';

-- Create index for faster lookups by auxiliary code
CREATE INDEX IF NOT EXISTS idx_journal_lines_auxiliary_code
ON erp_journal_lines(auxiliary_code)
WHERE auxiliary_code IS NOT NULL;
