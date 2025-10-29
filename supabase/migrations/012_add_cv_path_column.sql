-- Migration: Add cv_path column to candidates table
-- Date: 2025-10-27
-- Purpose: Fix fragile regex extraction from notes field
-- Security: Ensure CV paths are stored properly for access control

-- Add cv_path column (nullable for existing records)
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS cv_path TEXT;

-- Add index for efficient lookup by CV path
CREATE INDEX IF NOT EXISTS idx_candidates_cv_path
ON candidates(cv_path)
WHERE cv_path IS NOT NULL;

-- Migrate existing data: Extract CV path from notes field
-- Pattern in notes: "Path: <cv_path>"
UPDATE candidates
SET cv_path = SUBSTRING(notes FROM 'Path: ([^\|\n]+)')
WHERE notes LIKE '%Path:%'
  AND cv_path IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN candidates.cv_path IS 'Path to CV file in Supabase Storage (bucket: cv). Extracted from notes field during migration 012.';

-- Verification query (run manually to check migration)
-- SELECT
--   id,
--   CASE
--     WHEN cv_path IS NOT NULL THEN 'Migrated'
--     WHEN notes LIKE '%Path:%' THEN 'Needs Migration'
--     ELSE 'No CV'
--   END as migration_status,
--   cv_path,
--   SUBSTRING(notes FROM 'Path: ([^\|\n]+)') as extracted_path
-- FROM candidates
-- LIMIT 10;
