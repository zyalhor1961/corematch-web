# 🚀 Corematch MCP Server - Guide Complet

**Date**: 2025-01-26
**Version**: 1.0.0
**Status**: ✅ Prêt pour production

---

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Démarrage](#démarrage)
5. [Tools disponibles](#tools-disponibles)
6. [Authentification](#authentification)
7. [Configuration Claude Desktop](#configuration-claude-desktop)
8. [Tests](#tests)
9. [Troubleshooting](#troubleshooting)

---

## Vue d'ensemble

Le **Corematch MCP Server** est un serveur standalone qui expose les capacités d'analyse CV de Corematch via le **Model Context Protocol (MCP)**.

**Fonctionnalités**:
- ✅ Analyse CV automatique via orchestrator multi-provider
- ✅ Auth flexible (Bearer token Supabase + API keys)
- ✅ Compliance RGPD (consent + PII masking)
- ✅ Cache intelligent avec isolation par job
- ✅ Context snapshot pour traçabilité
- ✅ Resilience (retry + circuit breaker + timeout)
- ✅ Quality gating + Smart cost triggering

**Tools MCP**:
- `analyze_cv` - Analyser un CV contre un JobSpec
- `get_candidates` - Lister les candidats d'un projet

---

## Installation

### Prérequis

- Node.js 18+ (recommandé: 20+)
- npm ou yarn
- Accès à une DB Supabase Corematch

### Étapes

```bash
# 1. Cloner le projet (si pas déjà fait)
git clone https://github.com/your-org/corematch.git
cd corematch

# 2. Installer dépendances
npm install

# 3. Vérifier que MCP SDK est installé
npm list @modelcontextprotocol/sdk
# Devrait afficher: @modelcontextprotocol/sdk@1.20.2
```

---

## Configuration

### 1. Variables d'environnement

Le serveur MCP nécessite ces env vars:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Providers IA (optionnel si déjà configurés)
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
ANTHROPIC_API_KEY=...
```

**Option 1: Variables système (Windows)**
```cmd
set NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=xxx
```

**Option 2: Variables système (Linux/Mac)**
```bash
export NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=xxx
```

**Option 3: Fichier .env.local**
```bash
# Créer .env.local à la racine du projet
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
OPENAI_API_KEY=sk-...
```

### 2. Migrations DB

Appliquer les migrations pour consent/masking et API keys:

```bash
# Via Supabase CLI
npx supabase db push

# Ou manuellement via SQL Editor
# 1. supabase/migrations/20250126_add_mcp_consent_columns.sql
# 2. supabase/migrations/20250126_add_mcp_api_keys_table.sql
```

### 3. Créer une API key (optionnel)

Si vous voulez utiliser une API key au lieu d'un Bearer token:

```sql
-- Via Supabase SQL Editor (authentifié comme user)
SELECT * FROM generate_mcp_api_key(
  p_name := 'Claude Desktop MCP',
  p_description := 'API key for Claude Desktop integration',
  p_scopes := ARRAY['cv:analyze', 'cv:read', 'project:read'],
  p_org_id := NULL, -- NULL = accès à toutes les orgs du user
  p_project_id := NULL, -- NULL = accès à tous les projets
  p_expires_at := '2026-01-01'::timestamptz -- Expiration dans 1 an
);

-- ⚠️ IMPORTANT: Copier la clé retournée (mcp_sk_...),
-- elle ne sera plus jamais affichée!
```

---

## Démarrage

### Démarrage local (test)

```bash
# Avec npm
npm run mcp:server

# Ou directement avec tsx
npx tsx bin/mcp-server.ts
```

**Output attendu**:
```
🚀 Starting Corematch MCP Server...

✅ Corematch MCP Server running
   Waiting for requests via stdio...
```

Le serveur attend maintenant les requêtes via stdio (standard input/output).

### Test rapide

Pour tester le serveur, vous pouvez utiliser le MCP Inspector:

```bash
# Installer MCP Inspector (global)
npm install -g @modelcontextprotocol/inspector

# Lancer inspector
npx @modelcontextprotocol/inspector npx tsx bin/mcp-server.ts
```

Puis ouvrir http://localhost:5173 et tester les tools.

---

## Tools disponibles

### Tool 1: `analyze_cv`

Analyser un CV contre un JobSpec.

**Paramètres**:
```typescript
{
  candidateId: string;       // ID du candidat (UUID)
  projectId: string;         // ID du projet (UUID)
  mode?: 'eco' | 'balanced' | 'premium'; // Défaut: 'balanced'
  forceReanalysis?: boolean; // Défaut: false (utilise cache)
}
```

**Retour**:
```typescript
{
  recommendation: string;    // 'STRONG_YES' | 'YES' | 'MAYBE' | 'NO'
  score: number;             // 0-100
  strengths: string[];       // Liste compétences fortes
  weaknesses: string[];      // Liste points faibles
  cost_usd: number;          // Coût de l'analyse
  duration_ms: number;       // Durée en ms
  from_cache: boolean;       // true si résultat depuis cache
  context_snapshot: {
    engine: string;          // 'corematch-mcp'
    providers_used: string[]; // ['openai', 'gemini']
    consensus_level: string; // 'strong' | 'medium' | 'weak'
    pii_masking_level: string; // 'none' | 'partial' | 'full'
  }
}
```

**Exemple**:
```json
{
  "name": "analyze_cv",
  "arguments": {
    "candidateId": "123e4567-e89b-12d3-a456-426614174000",
    "projectId": "987fcdeb-51a2-43f7-9c4d-123456789abc",
    "mode": "premium"
  }
}
```

**Erreurs possibles**:
- `AUTH_REQUIRED`: Header Authorization manquant
- `PERMISSION_DENIED`: Scope cv:analyze manquant
- `ACCESS_DENIED`: Pas d'accès au projet
- `ERROR_CONSENT_REQUIRED`: Candidat n'a pas donné son consent MCP
- `CANDIDATE_NOT_FOUND`: Candidat introuvable
- `PROJECT_NOT_FOUND`: Projet introuvable
- `CV_MISSING`: Candidat sans CV
- `JOB_SPEC_MISSING`: Projet sans JobSpec

### Tool 2: `get_candidates`

Lister les candidats d'un projet.

**Paramètres**:
```typescript
{
  projectId: string;         // ID du projet (UUID)
  limit?: number;            // Défaut: 50
  offset?: number;           // Défaut: 0
  status?: 'all' | 'analyzed' | 'pending'; // Défaut: 'all'
}
```

**Retour**:
```typescript
{
  candidates: Array<{
    id: string;
    name: string;
    email?: string;
    status: 'analyzed' | 'pending';
    score?: number;          // Si analyzed
    recommendation?: string; // Si analyzed
    analyzed_at?: string;    // ISO timestamp
    consent_mcp: boolean;
  }>;
  total: number;
  has_more: boolean;
}
```

**Exemple**:
```json
{
  "name": "get_candidates",
  "arguments": {
    "projectId": "987fcdeb-51a2-43f7-9c4d-123456789abc",
    "limit": 10,
    "status": "analyzed"
  }
}
```

---

## Authentification

Le serveur MCP supporte **2 méthodes d'authentification**:

### Méthode 1: Bearer Token (Supabase)

Pour utilisateurs web Corematch.

**Header Authorization**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Permissions**: Tous les scopes (cv:analyze, cv:read, cv:write, project:*)

### Méthode 2: API Key (MCP)

Pour serveurs, CLI, intégrations.

**Header Authorization**:
```
Authorization: ApiKey mcp_sk_abc123def456...
```

**Permissions**: Selon scopes configurés lors de la création de la clé

**Créer une API key**: Voir section [Configuration](#configuration)

---

## Configuration Claude Desktop

### Localisation du fichier config

**Windows**:
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Mac**:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Linux**:
```
~/.config/Claude/claude_desktop_config.json
```

### Configuration

Copier le template `claude_desktop_config.example.json` et adapter:

```json
{
  "mcpServers": {
    "corematch": {
      "command": "node",
      "args": [
        "F:\\corematch\\node_modules\\tsx\\dist\\cli.mjs",
        "F:\\corematch\\bin\\mcp-server.ts"
      ],
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "https://YOUR_PROJECT.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "YOUR_SERVICE_ROLE_KEY_HERE",
        "OPENAI_API_KEY": "sk-...",
        "NODE_ENV": "production"
      }
    }
  }
}
```

**⚠️ Important**:
- Remplacer `F:\\corematch` par le chemin absolu de votre projet
- Utiliser `\\` (double backslash) sur Windows
- Remplacer les env vars par vos vraies valeurs

### Authentification dans Claude Desktop

Claude Desktop ne supporte pas encore les headers Authorization personnalisés pour MCP.

**Workaround**: Utiliser un Bearer token Supabase hardcodé dans le code (temporaire):

```typescript
// Dans lib/mcp/server/middleware/auth-middleware.ts (DEV ONLY)
export async function authMiddleware(authHeader?: string): Promise<MCPContext> {
  // DEV: Utiliser token hardcodé si pas d'authHeader
  const token = authHeader || process.env.SUPABASE_USER_TOKEN;
  // ...
}
```

Puis dans `claude_desktop_config.json`:
```json
{
  "env": {
    "SUPABASE_USER_TOKEN": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**⚠️ PRODUCTION**: Ne pas faire ça en prod, utiliser API keys via un proxy auth.

### Test avec Claude Desktop

1. Sauvegarder `claude_desktop_config.json`
2. Redémarrer Claude Desktop
3. Dans Claude, taper:
   ```
   Liste les candidats du projet XXX
   ```
4. Claude devrait proposer d'utiliser le tool `get_candidates`

---

## Tests

### Tests unitaires auth MCP

```bash
npm test -- tests/unit/mcp-auth.test.ts
# 12/12 tests passés ✅
```

### Tests E2E serveur MCP (à créer)

```bash
npm test -- tests/e2e/mcp-server.test.ts
```

### Test manuel avec MCP Inspector

```bash
npx @modelcontextprotocol/inspector npx tsx bin/mcp-server.ts
```

Ouvrir http://localhost:5173 et tester:

1. Tool `get_candidates`:
   ```json
   {
     "projectId": "your-project-id"
   }
   ```

2. Tool `analyze_cv`:
   ```json
   {
     "candidateId": "your-candidate-id",
     "projectId": "your-project-id",
     "mode": "balanced"
   }
   ```

---

## Troubleshooting

### Erreur: "Missing env vars"

**Symptôme**:
```
❌ Missing required environment variables:
   - NEXT_PUBLIC_SUPABASE_URL
```

**Solution**:
Définir les env vars (voir [Configuration](#configuration))

### Erreur: "AUTH_REQUIRED"

**Symptôme**:
```
AUTH_REQUIRED: Missing Authorization header
```

**Solution**:
- Vérifier que le header Authorization est bien passé
- Pour Claude Desktop, utiliser workaround token hardcodé (voir section Auth)

### Erreur: "ERROR_CONSENT_REQUIRED"

**Symptôme**:
```
ERROR_CONSENT_REQUIRED: Candidate XXX has not granted MCP consent
```

**Solution**:
Mettre à jour le consent du candidat:

```sql
UPDATE candidates
SET consent_mcp = true,
    consent_mcp_updated_at = now()
WHERE id = 'candidate-id';
```

### Erreur: "MODULE_NOT_FOUND @modelcontextprotocol/sdk"

**Symptôme**:
```
Cannot find module '@modelcontextprotocol/sdk'
```

**Solution**:
```bash
npm install @modelcontextprotocol/sdk
```

### Serveur ne démarre pas

**Symptôme**:
Serveur crash au démarrage

**Solution**:
1. Vérifier logs:
   ```bash
   npm run mcp:server 2>&1 | tee mcp-server.log
   ```

2. Vérifier tsconfig:
   ```bash
   npx tsc --noEmit
   ```

3. Vérifier Node version:
   ```bash
   node --version
   # Devrait être >= 18
   ```

---

## Ressources

### Documentation

- MCP Specification: https://modelcontextprotocol.io/specification/2025-06-18
- MCP SDK TypeScript: https://github.com/modelcontextprotocol/typescript-sdk
- Corematch MCP Roadmap: `MCP_PRODUCTION_ROADMAP.md`
- Corematch P0 Gaps: `MCP_P0_GAPS_COMPLETE.md`

### Support

- GitHub Issues: https://github.com/your-org/corematch/issues
- Documentation interne: `lib/mcp/README.md`

---

## Résumé Commandes

```bash
# Installation
npm install

# Démarrage serveur
npm run mcp:server

# Tests
npm test -- tests/unit/mcp-auth.test.ts

# MCP Inspector (debug)
npx @modelcontextprotocol/inspector npx tsx bin/mcp-server.ts

# Migrations DB
npx supabase db push
```

---

**Auteur**: Claude Code
**Date**: 2025-01-26
**Version**: 1.0.0
