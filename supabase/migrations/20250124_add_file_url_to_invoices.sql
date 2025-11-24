-- Migration: Add file_url column to invoices table for PDF storage
-- Date: 2025-01-24
-- Description: Enables storing uploaded invoice PDFs from Supabase Storage

-- Add file_url column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'invoices'
        AND column_name = 'file_url'
    ) THEN
        ALTER TABLE invoices ADD COLUMN file_url TEXT;
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN invoices.file_url IS 'Public URL of the uploaded invoice file from Supabase Storage';
