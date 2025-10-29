-- Migration 010: MCP + RGPD Fields (Simplified for manual execution)
-- Execute this in Supabase SQL Editor

-- 1. Add consent_mcp to candidates
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS consent_mcp BOOLEAN DEFAULT false;

-- 2. Add pii_masking_level to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pii_masking_level VARCHAR(20) DEFAULT 'partial'
CHECK (pii_masking_level IN ('none', 'partial', 'full'));

-- 3. Create mcp_audit_logs table
CREATE TABLE IF NOT EXISTS mcp_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(255) NOT NULL,
  request_id VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  tool_name VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  job_spec_hash VARCHAR(64),
  analysis_mode VARCHAR(20),
  pii_masking_level VARCHAR(20),
  consent_mcp_checked BOOLEAN DEFAULT false,
  consent_mcp_granted BOOLEAN,
  status VARCHAR(50) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'timeout', 'denied')),
  error_message TEXT,
  duration_ms INTEGER,
  cost_usd DECIMAL(10,6),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create mcp_sessions table
CREATE TABLE IF NOT EXISTS mcp_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  context JSONB DEFAULT '{}'::jsonb,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_candidates_consent_mcp ON candidates(consent_mcp) WHERE consent_mcp = true;
CREATE INDEX IF NOT EXISTS idx_mcp_audit_session ON mcp_audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_user ON mcp_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_candidate ON mcp_audit_logs(candidate_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_created ON mcp_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_session_id ON mcp_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_expires_at ON mcp_sessions(expires_at);

-- 6. Enable RLS
ALTER TABLE mcp_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_sessions ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for mcp_audit_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mcp_audit_logs' AND policyname = 'Users can view own MCP audit logs'
  ) THEN
    CREATE POLICY "Users can view own MCP audit logs"
    ON mcp_audit_logs FOR SELECT
    USING (
      auth.uid() = user_id
      OR EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.org_id = mcp_audit_logs.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('org_admin', 'org_manager')
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mcp_audit_logs' AND policyname = 'Authenticated users can insert MCP audit logs'
  ) THEN
    CREATE POLICY "Authenticated users can insert MCP audit logs"
    ON mcp_audit_logs FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- 8. RLS Policies for mcp_sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mcp_sessions' AND policyname = 'Users can view own MCP sessions'
  ) THEN
    CREATE POLICY "Users can view own MCP sessions"
    ON mcp_sessions FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mcp_sessions' AND policyname = 'Users can insert own MCP sessions'
  ) THEN
    CREATE POLICY "Users can insert own MCP sessions"
    ON mcp_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mcp_sessions' AND policyname = 'Users can update own MCP sessions'
  ) THEN
    CREATE POLICY "Users can update own MCP sessions"
    ON mcp_sessions FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mcp_sessions' AND policyname = 'Users can delete own MCP sessions'
  ) THEN
    CREATE POLICY "Users can delete own MCP sessions"
    ON mcp_sessions FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- 9. Helper functions
CREATE OR REPLACE FUNCTION get_project_pii_masking_level(project_id_param UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
  masking_level VARCHAR(20);
BEGIN
  SELECT pii_masking_level INTO masking_level
  FROM projects
  WHERE id = project_id_param;
  RETURN COALESCE(masking_level, 'partial');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_mcp_consent(candidate_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  has_consent BOOLEAN;
BEGIN
  SELECT consent_mcp INTO has_consent
  FROM candidates
  WHERE id = candidate_id_param;
  RETURN COALESCE(has_consent, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Done!
SELECT '✅ Migration 010 applied successfully!' AS status;
