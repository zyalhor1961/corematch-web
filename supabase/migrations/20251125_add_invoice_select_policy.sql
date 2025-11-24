-- Migration: Add SELECT policy for invoices
-- Date: 2025-11-25
-- Description: Allow authenticated users to view invoices from their organization

-- Allow authenticated users to SELECT invoices belonging to their organization
CREATE POLICY "Enable select for authenticated users"
ON invoices
FOR SELECT
TO authenticated
USING (
  org_id IN (
    SELECT org_id 
    FROM organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Grant necessary permissions
GRANT SELECT ON invoices TO authenticated;
