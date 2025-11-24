-- Migration: Add INSERT policy for invoices
-- Date: 2025-11-25
-- Description: Allow authenticated users to insert new invoices

-- Allow authenticated users to INSERT invoices
-- This is required for the upload functionality to work
CREATE POLICY "Enable insert for authenticated users"
ON invoices
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Grant necessary permissions just in case
GRANT INSERT ON invoices TO authenticated;
