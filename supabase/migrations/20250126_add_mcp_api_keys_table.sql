-- Migration: Ajouter table mcp_api_keys
-- Date: 2025-01-26
-- Purpose: Gap #1 - Implémenter auth MCP avec API keys

-- ============================================================================
-- Table: mcp_api_keys - Clés API pour authentification MCP
-- ============================================================================

-- Table principale
CREATE TABLE IF NOT EXISTS mcp_api_keys (
  -- Identifiant
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  -- API Key (hashée, jamais en clair)
  key_hash TEXT NOT NULL UNIQUE,

  -- Métadonnées
  name TEXT NOT NULL, -- Nom de la clé (ex: "Production MCP Server")
  description TEXT, -- Description optionnelle

  -- Permissions (scopes)
  scopes TEXT[] NOT NULL DEFAULT '{}', -- Ex: ['cv:analyze', 'cv:read', 'project:read']

  -- État
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Expiration
  expires_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,

  -- Contraintes
  CONSTRAINT valid_scopes CHECK (
    scopes <@ ARRAY['cv:analyze', 'cv:read', 'cv:write', 'project:read', 'project:write', 'cv:*', 'project:*']
  )
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_user_id ON mcp_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_org_id ON mcp_api_keys(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_project_id ON mcp_api_keys(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_key_hash ON mcp_api_keys(key_hash) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_active ON mcp_api_keys(is_active, expires_at);

-- Commentaires
COMMENT ON TABLE mcp_api_keys IS 'Clés API pour authentification MCP (serveurs, CLI, intégrations)';
COMMENT ON COLUMN mcp_api_keys.key_hash IS 'Hash SHA-256 de la clé API (jamais stocker en clair)';
COMMENT ON COLUMN mcp_api_keys.scopes IS 'Permissions accordées (cv:analyze, cv:read, cv:write, project:read, project:write, ou wildcards cv:*, project:*)';
COMMENT ON COLUMN mcp_api_keys.org_id IS 'Si défini, limite l''accès à cette organisation';
COMMENT ON COLUMN mcp_api_keys.project_id IS 'Si défini, limite l''accès à ce projet uniquement';
COMMENT ON COLUMN mcp_api_keys.expires_at IS 'Date d''expiration (NULL = pas d''expiration)';
COMMENT ON COLUMN mcp_api_keys.last_used_at IS 'Dernière utilisation de la clé (mis à jour à chaque requête)';

-- ============================================================================
-- RLS (Row Level Security)
-- ============================================================================

ALTER TABLE mcp_api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Utilisateurs peuvent voir leurs propres clés
CREATE POLICY "Users can view their own API keys"
  ON mcp_api_keys
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Utilisateurs peuvent créer leurs propres clés
CREATE POLICY "Users can create their own API keys"
  ON mcp_api_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Utilisateurs peuvent mettre à jour leurs propres clés (name, description, is_active)
CREATE POLICY "Users can update their own API keys"
  ON mcp_api_keys
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Utilisateurs peuvent supprimer leurs propres clés
CREATE POLICY "Users can delete their own API keys"
  ON mcp_api_keys
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Extension: pgcrypto pour hashing SHA-256
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- Fonction: Générer une nouvelle API key
-- ============================================================================

-- Helper function pour créer une nouvelle clé API
-- Retourne la clé en clair (à afficher une seule fois à l'utilisateur)
CREATE OR REPLACE FUNCTION generate_mcp_api_key(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_scopes TEXT[] DEFAULT ARRAY['cv:analyze', 'cv:read'],
  p_org_id UUID DEFAULT NULL,
  p_project_id UUID DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  api_key TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_api_key TEXT;
  v_key_hash TEXT;
  v_user_id UUID;
  v_key_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Générer une clé aléatoire (format: mcp_sk_{48 chars hex})
  v_api_key := 'mcp_sk_' || encode(gen_random_bytes(24), 'hex');

  -- Hasher la clé pour stockage sécurisé (SHA-256 via pgcrypto)
  v_key_hash := 'sha256_' || encode(digest(v_api_key, 'sha256'), 'hex');

  -- Insérer dans la table
  INSERT INTO mcp_api_keys (
    user_id,
    org_id,
    project_id,
    key_hash,
    name,
    description,
    scopes,
    expires_at
  ) VALUES (
    v_user_id,
    p_org_id,
    p_project_id,
    v_key_hash,
    p_name,
    p_description,
    p_scopes,
    p_expires_at
  )
  RETURNING mcp_api_keys.id INTO v_key_id;

  -- Retourner l'ID et la clé en clair (une seule fois!)
  RETURN QUERY SELECT v_key_id, v_api_key, now();
END;
$$;

COMMENT ON FUNCTION generate_mcp_api_key IS 'Générer une nouvelle clé API MCP (à afficher une seule fois à l''utilisateur)';

-- ============================================================================
-- Audit: Vérifier que la table existe
-- ============================================================================

DO $$
BEGIN
  -- Vérifier mcp_api_keys
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'mcp_api_keys'
  ) THEN
    RAISE EXCEPTION 'Table mcp_api_keys was not created';
  END IF;

  RAISE NOTICE 'MCP API keys table created successfully';
END $$;
