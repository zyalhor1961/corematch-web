-- Migration: Add RLS policies for invoice validation workflow
-- Date: 2025-01-24
-- Description: Allow authenticated users to update invoices and jobs tables for the "Valider" button

-- Enable RLS on tables (if not already enabled)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Enable update for authenticated users" ON invoices;
DROP POLICY IF EXISTS "Enable update for jobs" ON jobs;

-- Allow authenticated users to UPDATE invoices (Required for the "Valider" button)
CREATE POLICY "Enable update for authenticated users"
ON invoices
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to UPDATE jobs (Required to sync status)
CREATE POLICY "Enable update for jobs"
ON jobs
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Optional: Add SELECT policies if they don't exist yet
CREATE POLICY IF NOT EXISTS "Enable read for authenticated users"
ON invoices
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY IF NOT EXISTS "Enable read for jobs"
ON jobs
FOR SELECT
TO authenticated
USING (true);

-- Grant necessary table permissions
GRANT UPDATE ON invoices TO authenticated;
GRANT UPDATE ON jobs TO authenticated;
GRANT SELECT ON invoices TO authenticated;
GRANT SELECT ON jobs TO authenticated;
