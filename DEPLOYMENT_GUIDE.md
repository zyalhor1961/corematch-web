# 🚀 Guide de Déploiement Production MCP

**Les étapes détaillées pour déployer le serveur MCP en production**

## Étape 1: Appliquer Migrations DB

Vérifier connexion Supabase:
```bash
npx supabase status
```

Appliquer migrations:
```bash
npx supabase db push
```

Vérifier via SQL Editor:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'candidates' AND column_name = 'consent_mcp';

SELECT table_name FROM information_schema.tables
WHERE table_name = 'mcp_api_keys';
```

## Étape 2: Créer API Key

Via Supabase SQL Editor:
```sql
SELECT * FROM generate_mcp_api_key(
  p_name := 'Production MCP',
  p_scopes := ARRAY['cv:analyze', 'cv:read']
);
-- ⚠️ COPIER la clé mcp_sk_... immédiatement!
```

## Étape 3: Configurer .env.production

Voir: MCP_NEXT_STEPS.md section "Étape 1.3"

## Étape 4: Activer Consent

```sql
UPDATE candidates SET consent_mcp = true
WHERE project_id = 'YOUR_PROJECT_ID';
```

## Étape 5: Tester

```bash
export $(cat .env.production | xargs)
npx @modelcontextprotocol/inspector npm run mcp:server
```

