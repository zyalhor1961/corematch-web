/**
 * Migration 010: MCP + RGPD Compliance Fields
 *
 * Ajoute les champs nécessaires pour:
 * - Consent MCP (RGPD Article 7)
 * - Niveau de masking PII par projet
 * - Audit trail MCP
 * - Cache keys avec jobSpecHash
 */

-- ============================================================================
-- 1. Ajouter consent_mcp à la table candidates
-- ============================================================================

-- Champ consent pour analyse MCP (RGPD)
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS consent_mcp BOOLEAN DEFAULT false;

-- Index pour query rapide (filtrer candidats avec consent)
CREATE INDEX IF NOT EXISTS idx_candidates_consent_mcp
ON candidates(consent_mcp)
WHERE consent_mcp = true;

-- Commentaire pour documentation
COMMENT ON COLUMN candidates.consent_mcp IS
'RGPD compliance: Candidate consent for MCP (Model Context Protocol) analysis. Must be true before sending CV to external LLMs via MCP.';

-- ============================================================================
-- 2. Ajouter pii_masking_level à la table projects
-- ============================================================================

-- Niveau de masking PII pour le projet
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS pii_masking_level VARCHAR(20) DEFAULT 'partial'
CHECK (pii_masking_level IN ('none', 'partial', 'full'));

-- Commentaire pour documentation
COMMENT ON COLUMN projects.pii_masking_level IS
'PII masking level for all analyses in this project:
- none: No masking (internal use only)
- partial: Mask email/linkedin/phone (keep name)
- full: Mask all PII including name and employers';

-- ============================================================================
-- 3. Créer table mcp_audit_logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Session & Request IDs
  session_id VARCHAR(255) NOT NULL,
  request_id VARCHAR(255) NOT NULL,

  -- User & Organization
  user_id UUID REFERENCES auth.users(id),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- MCP Tool Call
  tool_name VARCHAR(100) NOT NULL,

  -- Resource accessed
  resource_type VARCHAR(50), -- 'cv', 'job', 'project', 'candidate'
  resource_id UUID,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,

  -- Context
  job_spec_hash VARCHAR(64),
  analysis_mode VARCHAR(20),

  -- Compliance
  pii_masking_level VARCHAR(20),
  consent_mcp_checked BOOLEAN DEFAULT false,
  consent_mcp_granted BOOLEAN,

  -- Result
  status VARCHAR(50) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'timeout', 'denied')),
  error_message TEXT,

  -- Performance
  duration_ms INTEGER,
  cost_usd DECIMAL(10,6),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour queries fréquentes
CREATE INDEX IF NOT EXISTS idx_mcp_audit_session ON mcp_audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_user ON mcp_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_candidate ON mcp_audit_logs(candidate_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_created ON mcp_audit_logs(created_at DESC);

-- Commentaire pour documentation
COMMENT ON TABLE mcp_audit_logs IS
'Audit trail for all MCP (Model Context Protocol) operations. Tracks who accessed what data, with what masking level, for RGPD compliance.';

-- ============================================================================
-- 4. Créer table mcp_sessions (optionnel, pour session store)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mcp_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Session ID (MCP protocol)
  session_id VARCHAR(255) UNIQUE NOT NULL,

  -- User & Organization
  user_id UUID REFERENCES auth.users(id),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Session context (JSON)
  context JSONB DEFAULT '{}'::jsonb,

  -- Expiration
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour cleanup et lookup
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_session_id ON mcp_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_expires_at ON mcp_sessions(expires_at);

-- Fonction de cleanup automatique (appelée périodiquement)
CREATE OR REPLACE FUNCTION cleanup_expired_mcp_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM mcp_sessions
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_mcp_sessions IS
'Cleanup expired MCP sessions. Should be called periodically (e.g., every 5 minutes via cron).';

-- ============================================================================
-- 5. Ajouter job_spec_hash à la table evaluations (si elle existe)
-- ============================================================================

-- Vérifier si la table evaluations existe (créée dans une migration précédente)
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_name = 'evaluations'
  ) THEN
    -- Ajouter job_spec_hash si pas déjà présent
    IF NOT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_name = 'evaluations' AND column_name = 'job_spec_hash'
    ) THEN
      ALTER TABLE evaluations
      ADD COLUMN job_spec_hash VARCHAR(64);

      CREATE INDEX idx_evaluations_job_spec_hash ON evaluations(job_spec_hash);

      COMMENT ON COLUMN evaluations.job_spec_hash IS
      'SHA256 hash of JobSpec (first 16 chars). Used for cache key generation and detecting JobSpec changes.';
    END IF;
  END IF;
END
$$;

-- ============================================================================
-- 6. RLS (Row Level Security) pour les nouvelles tables
-- ============================================================================

-- Enable RLS
ALTER TABLE mcp_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own MCP audit logs
CREATE POLICY "Users can view own MCP audit logs"
ON mcp_audit_logs
FOR SELECT
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.org_id = mcp_audit_logs.org_id
    AND om.user_id = auth.uid()
    AND om.role IN ('org_admin', 'org_manager')
  )
);

-- Policy: Only authenticated users can insert audit logs (via app code)
CREATE POLICY "Authenticated users can insert MCP audit logs"
ON mcp_audit_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Users can view own MCP sessions
CREATE POLICY "Users can view own MCP sessions"
ON mcp_sessions
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert own MCP sessions
CREATE POLICY "Users can insert own MCP sessions"
ON mcp_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update own MCP sessions
CREATE POLICY "Users can update own MCP sessions"
ON mcp_sessions
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Users can delete own MCP sessions
CREATE POLICY "Users can delete own MCP sessions"
ON mcp_sessions
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- 7. Fonctions helper pour queries courantes
-- ============================================================================

-- Fonction: Obtenir le niveau de masking PII d'un projet
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

-- Fonction: Vérifier consent MCP d'un candidat
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

-- Fonction: Statistiques MCP par projet
CREATE OR REPLACE FUNCTION get_mcp_stats_by_project(project_id_param UUID)
RETURNS TABLE (
  total_analyses INTEGER,
  with_consent INTEGER,
  without_consent INTEGER,
  total_cost_usd DECIMAL(10,2),
  avg_duration_ms INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_analyses,
    COUNT(*) FILTER (WHERE consent_mcp_granted = true)::INTEGER AS with_consent,
    COUNT(*) FILTER (WHERE consent_mcp_granted = false OR consent_mcp_granted IS NULL)::INTEGER AS without_consent,
    COALESCE(SUM(cost_usd), 0)::DECIMAL(10,2) AS total_cost_usd,
    COALESCE(AVG(duration_ms), 0)::INTEGER AS avg_duration_ms
  FROM mcp_audit_logs
  WHERE project_id = project_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. Seed data (pour tests)
-- ============================================================================

-- Aucun seed data pour l'instant (à faire en dev/staging)

-- ============================================================================
-- Migration terminée
-- ============================================================================

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 010 completed: MCP + RGPD fields added';
  RAISE NOTICE '- candidates.consent_mcp (BOOLEAN)';
  RAISE NOTICE '- projects.pii_masking_level (VARCHAR)';
  RAISE NOTICE '- mcp_audit_logs (TABLE)';
  RAISE NOTICE '- mcp_sessions (TABLE)';
  RAISE NOTICE '- RLS policies enabled';
  RAISE NOTICE '- Helper functions created';
END
$$;
