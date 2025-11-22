-- =============================================================================
-- DAF Saved Queries - Store frequently used questions
-- =============================================================================

-- Table to store saved queries
CREATE TABLE IF NOT EXISTS daf_saved_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Query details
  title TEXT NOT NULL,
  question TEXT NOT NULL,

  -- Categorization
  category TEXT DEFAULT 'general',
  is_favorite BOOLEAN DEFAULT false,

  -- Usage tracking
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Sharing (future feature)
  is_shared BOOLEAN DEFAULT false,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_queries_org_user
  ON daf_saved_queries(org_id, user_id, is_favorite DESC, use_count DESC);

CREATE INDEX IF NOT EXISTS idx_saved_queries_category
  ON daf_saved_queries(org_id, category);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_saved_queries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_saved_queries_updated_at ON daf_saved_queries;
CREATE TRIGGER trigger_saved_queries_updated_at
  BEFORE UPDATE ON daf_saved_queries
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_queries_updated_at();

-- Row Level Security
ALTER TABLE daf_saved_queries ENABLE ROW LEVEL SECURITY;

-- Users can only access their own saved queries
DROP POLICY IF EXISTS "Users access own saved queries" ON daf_saved_queries;
CREATE POLICY "Users access own saved queries" ON daf_saved_queries
  FOR ALL USING (
    user_id = auth.uid() AND
    org_id IN (
      SELECT org_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Grant permissions
GRANT ALL ON daf_saved_queries TO authenticated;

-- Comment
COMMENT ON TABLE daf_saved_queries IS 'Stores saved Ask DAF queries for quick reuse';
