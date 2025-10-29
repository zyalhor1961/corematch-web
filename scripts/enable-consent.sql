-- ════════════════════════════════════════════════
-- Script: Activer le consent MCP pour tous les candidats
-- Date: 2025-10-27
-- ════════════════════════════════════════════════

-- IMPORTANT: Exécuter ce script dans Supabase SQL Editor
-- https://supabase.com/dashboard/project/glexllbywdvlxpbanjmn/sql/new

-- ════════════════════════════════════════════════
-- Méthode 1: Activer pour TOUS les candidats
-- ════════════════════════════════════════════════

UPDATE candidates
SET consent_mcp = true
WHERE consent_mcp IS NULL OR consent_mcp = false;

-- ════════════════════════════════════════════════
-- Méthode 2: Activer pour UN projet spécifique
-- ════════════════════════════════════════════════

-- Remplacer 'YOUR_PROJECT_ID' par votre ID de projet
-- UPDATE candidates
-- SET consent_mcp = true
-- WHERE project_id = 'YOUR_PROJECT_ID'
--   AND (consent_mcp IS NULL OR consent_mcp = false);

-- ════════════════════════════════════════════════
-- Vérification: Compter les candidats avec consent
-- ════════════════════════════════════════════════

SELECT
  COUNT(*) as total_candidates,
  COUNT(*) FILTER (WHERE consent_mcp = true) as with_consent,
  COUNT(*) FILTER (WHERE consent_mcp IS NULL OR consent_mcp = false) as without_consent
FROM candidates;

-- ════════════════════════════════════════════════
-- Vérification: Afficher quelques exemples
-- ════════════════════════════════════════════════

SELECT
  id,
  first_name,
  last_name,
  consent_mcp,
  project_id
FROM candidates
WHERE consent_mcp = true
LIMIT 10;
