-- Migration: Add extraction_data column to invoices
-- Date: 2025-11-25
-- Description: Store rich OCR metadata (coordinates, confidence) from Azure

ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS extraction_data JSONB DEFAULT '{}'::jsonb;
