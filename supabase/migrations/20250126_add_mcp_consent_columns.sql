-- Migration: Ajouter colonnes MCP consent et PII masking level
-- Date: 2025-01-26
-- Purpose: Gap #2 - Implémenter consent/masking DB

-- ============================================================================
-- Table: candidates - Ajouter colonnes consent MCP
-- ============================================================================

-- Colonne consent_mcp (défaut: false pour sécurité)
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS consent_mcp BOOLEAN DEFAULT false;

-- Colonne timestamp de mise à jour consent
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS consent_mcp_updated_at TIMESTAMPTZ;

-- Commentaires
COMMENT ON COLUMN candidates.consent_mcp IS 'Consent du candidat pour utilisation MCP (RGPD)';
COMMENT ON COLUMN candidates.consent_mcp_updated_at IS 'Timestamp dernière modification consent MCP';

-- Index pour optimiser les requêtes de vérification consent
-- (seulement les candidats avec consent = true)
CREATE INDEX IF NOT EXISTS idx_candidates_consent_mcp
  ON candidates(consent_mcp)
  WHERE consent_mcp = true;

-- ============================================================================
-- Table: projects - Ajouter colonne PII masking level
-- ============================================================================

-- Colonne pii_masking_level (défaut: 'partial' pour sécurité)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS pii_masking_level TEXT DEFAULT 'partial'
  CHECK (pii_masking_level IN ('none', 'partial', 'full'));

-- Commentaire
COMMENT ON COLUMN projects.pii_masking_level IS 'Niveau de masking PII pour MCP: none (pas de masking), partial (email/linkedin/tel masqués), full (tout masqué sauf compétences)';

-- Index pour analytics (optionnel)
CREATE INDEX IF NOT EXISTS idx_projects_pii_masking_level
  ON projects(pii_masking_level);

-- ============================================================================
-- RLS (Row Level Security) - Ajustements si nécessaire
-- ============================================================================

-- Les politiques RLS existantes sur candidates et projects
-- devraient automatiquement s'appliquer aux nouvelles colonnes.
-- Pas de changement nécessaire normalement.

-- ============================================================================
-- Audit: Vérifier que les colonnes existent
-- ============================================================================

DO $$
BEGIN
  -- Vérifier candidates.consent_mcp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'consent_mcp'
  ) THEN
    RAISE EXCEPTION 'Column candidates.consent_mcp was not created';
  END IF;

  -- Vérifier projects.pii_masking_level
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'pii_masking_level'
  ) THEN
    RAISE EXCEPTION 'Column projects.pii_masking_level was not created';
  END IF;

  RAISE NOTICE 'MCP consent columns created successfully';
END $$;
