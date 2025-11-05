-- Add extraction_result JSONB column to store complete extraction metadata
-- This includes field_positions for bounding boxes, provider info, confidence, etc.

ALTER TABLE daf_documents
ADD COLUMN IF NOT EXISTS extraction_result JSONB;

-- Index for querying extraction metadata
CREATE INDEX IF NOT EXISTS idx_daf_docs_extraction_provider
  ON daf_documents((extraction_result->>'provider'))
  WHERE extraction_result IS NOT NULL;

-- Comment explaining the column
COMMENT ON COLUMN daf_documents.extraction_result IS
  'Complete extraction result including field_positions (bounding boxes), provider, confidence, raw_response, etc.';
