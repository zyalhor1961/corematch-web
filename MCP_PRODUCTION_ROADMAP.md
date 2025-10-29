# 🚀 MCP Production Roadmap

**Date**: 2025-01-26
**Status**: Gaps P0 complétés ✅ → Prêt pour implémentation serveur MCP

---

## ✅ État Actuel

### Complété (100%)

**Phase 1 - Fondations**:
- ✅ Cache robuste avec isolation par job
- ✅ PII Masking 3 niveaux (none/partial/full)
- ✅ Context Snapshot pour traçabilité
- ✅ Migrations DB Supabase

**Phase 2 - Production Features**:
- ✅ Point #3: Resilience (retry + circuit breaker + timeout)
- ✅ Point #5: Evidence Quality Gating
- ✅ Point #6: Smart Cost Triggering

**Gaps P0 - Production Ready**:
- ✅ Gap #1: Auth MCP flexible (Bearer + ApiKey)
- ✅ Gap #2: Consent/Masking DB (stubs → real)
- ✅ Gap #4: ContextSnapshot flexible (engine dynamique)

**Tests**: 79/79 tests passés ✅
- Cache: 33 tests
- RGPD: 17 tests
- Resilience: 15 tests
- Quality Gating: 15 tests
- Cost Optimizer: 19 tests
- Auth MCP: 12 tests

---

## 🎯 PROCHAINE ÉTAPE: Serveur MCP

**Objectif**: Créer le serveur MCP standalone qui expose les tools via le protocol MCP

**Effort estimé**: 8-10 heures

### Étape 1: Installer MCP SDK (30 min)

```bash
npm install @modelcontextprotocol/sdk
```

### Étape 2: Créer le serveur MCP (4-5h)

**Fichiers à créer**:

#### 1. `lib/mcp/server/mcp-server.ts` (serveur principal)

```typescript
/**
 * Serveur MCP Corematch
 *
 * Expose tools MCP pour analyse CV:
 * - analyze_cv: Analyser un CV contre un JobSpec
 * - get_candidates: Lister candidats d'un projet
 * - get_analysis: Récupérer résultat d'analyse
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// MCP tools
import { analyzeCV } from './tools/analyze-cv';
import { getCandidates } from './tools/get-candidates';
import { getAnalysis } from './tools/get-analysis';

export async function startMCPServer() {
  const server = new Server({
    name: 'corematch-mcp',
    version: '1.0.0',
  }, {
    capabilities: {
      tools: {},
    },
  });

  // Register tools
  server.setRequestHandler('tools/list', async () => {
    return {
      tools: [
        {
          name: 'analyze_cv',
          description: 'Analyser un CV contre un JobSpec',
          inputSchema: {
            type: 'object',
            properties: {
              candidateId: { type: 'string' },
              projectId: { type: 'string' },
              mode: { type: 'string', enum: ['eco', 'balanced', 'premium'] },
            },
            required: ['candidateId', 'projectId'],
          },
        },
        {
          name: 'get_candidates',
          description: 'Lister les candidats d\'un projet',
          inputSchema: {
            type: 'object',
            properties: {
              projectId: { type: 'string' },
            },
            required: ['projectId'],
          },
        },
      ],
    };
  });

  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'analyze_cv':
        return await analyzeCV(args, request.meta?.authUser);
      case 'get_candidates':
        return await getCandidates(args, request.meta?.authUser);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.log('Corematch MCP Server started');
}
```

#### 2. `lib/mcp/server/tools/analyze-cv.ts` (tool principal)

```typescript
import { verifyMCPProjectAccess, verifyMCPScope } from '@/lib/auth/mcp-auth';
import { orchestrateAnalysis } from '@/lib/cv-analysis/orchestrator';
import { validateAnalysisRequest } from '@/lib/mcp/security/pii-masking';

export async function analyzeCV(args: any, authUser: any) {
  // Validation auth
  if (!authUser) {
    throw new Error('Authentication required');
  }

  if (!verifyMCPScope(authUser, 'cv:analyze')) {
    throw new Error('Insufficient permissions (cv:analyze required)');
  }

  const hasAccess = await verifyMCPProjectAccess(authUser, args.projectId);
  if (!hasAccess) {
    throw new Error('Access denied to this project');
  }

  // Validation RGPD
  const { consent_granted, pii_masking_level } = await validateAnalysisRequest({
    candidateId: args.candidateId,
    projectId: args.projectId,
    requireConsent: true,
  });

  // Récupérer CV et JobSpec depuis DB
  const { supabaseAdmin } = await import('@/lib/supabase/admin');

  const { data: candidate } = await supabaseAdmin
    .from('candidates')
    .select('cv_text, cv_json')
    .eq('id', args.candidateId)
    .single();

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('job_spec')
    .eq('id', args.projectId)
    .single();

  if (!candidate || !project) {
    throw new Error('Candidate or project not found');
  }

  // Orchestrer analyse
  const result = await orchestrateAnalysis(
    candidate.cv_text,
    project.job_spec,
    {
      mode: args.mode || 'balanced',
      projectId: args.projectId,
      candidateId: args.candidateId,
      engine: 'corematch-mcp', // ✅ Engine MCP
    }
  );

  // Sauvegarder résultat
  await supabaseAdmin
    .from('analyses')
    .insert({
      candidate_id: args.candidateId,
      project_id: args.projectId,
      result: result.final_decision,
      context_snapshot: result.context_snapshot,
      created_at: new Date().toISOString(),
    });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          recommendation: result.final_decision.recommendation,
          score: result.final_decision.overall_score_0_to_100,
          cost: result.cost.total_usd,
          duration_ms: result.performance.total_execution_time_ms,
        }, null, 2),
      },
    ],
  };
}
```

#### 3. `lib/mcp/server/middleware/auth-middleware.ts`

```typescript
import { verifyMCPAuth } from '@/lib/auth/mcp-auth';

export async function authMiddleware(request: any) {
  const authHeader = request.meta?.authorization;

  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }

  const authResult = await verifyMCPAuth(authHeader);

  if (!authResult.success) {
    throw new Error(`Authentication failed: ${authResult.error}`);
  }

  // Ajouter authUser au contexte
  request.meta.authUser = authResult.user;

  return request;
}
```

#### 4. `bin/mcp-server.ts` (point d'entrée)

```typescript
#!/usr/bin/env node
import { startMCPServer } from '../lib/mcp/server/mcp-server';

startMCPServer().catch((error) => {
  console.error('MCP Server error:', error);
  process.exit(1);
});
```

**package.json** ajout:
```json
{
  "scripts": {
    "mcp:server": "tsx bin/mcp-server.ts"
  },
  "bin": {
    "corematch-mcp": "./bin/mcp-server.ts"
  }
}
```

### Étape 3: Tests E2E serveur MCP (2-3h)

**Fichier**: `tests/e2e/mcp-server.test.ts`

Tests:
- ✅ Démarrage serveur
- ✅ Auth via Bearer token
- ✅ Auth via ApiKey
- ✅ Tool `analyze_cv` flow complet
- ✅ Tool `get_candidates`
- ✅ Gestion erreurs (consent refusé, projet non trouvé)
- ✅ Context snapshot correct
- ✅ Cache hit/miss

### Étape 4: Configuration Claude Desktop (1h)

**Fichier**: `claude_desktop_config.json` (exemple)

```json
{
  "mcpServers": {
    "corematch": {
      "command": "node",
      "args": ["/path/to/corematch/bin/mcp-server.ts"],
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "https://xxx.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "xxx",
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Étape 5: Documentation (1-2h)

**Fichiers**:
- `MCP_SERVER_GUIDE.md` - Guide d'installation et usage
- `MCP_TOOLS_REFERENCE.md` - Documentation des tools MCP

---

## 📋 Checklist Production

### Infrastructure

- [ ] Créer serveur MCP (`lib/mcp/server/`)
- [ ] Implémenter tools MCP (analyze_cv, get_candidates, get_analysis)
- [ ] Middleware auth
- [ ] Tests E2E

### Base de données

- [x] ✅ Migration consent/masking
- [x] ✅ Migration mcp_api_keys
- [ ] Créer API keys production (via SQL)
- [ ] Créer table `analyses` (si pas existante)

### Déploiement

- [ ] Tester serveur MCP localement
- [ ] Configurer Claude Desktop avec serveur local
- [ ] Tester flow complet: auth → analyze_cv → résultat
- [ ] Générer 2-3 API keys production
- [ ] Déployer serveur MCP (option 1: VPS, option 2: serverless)

### Monitoring

- [ ] Logger toutes les requêtes MCP (audit)
- [ ] Tracker coûts par session
- [ ] Tracker cache hit rate
- [ ] Alertes Sentry

### Documentation

- [ ] Guide installation serveur MCP
- [ ] Documentation tools MCP
- [ ] Guide génération API keys
- [ ] Exemples d'usage

---

## 🎯 Timeline Estimée

| Tâche | Durée | Status |
|-------|-------|--------|
| **Gaps P0** | 6h | ✅ Complété |
| **Installer MCP SDK** | 30 min | ⏳ Prochaine étape |
| **Créer serveur MCP** | 4-5h | ⏳ À faire |
| **Tests E2E** | 2-3h | ⏳ À faire |
| **Config Claude Desktop** | 1h | ⏳ À faire |
| **Documentation** | 1-2h | ⏳ À faire |
| **Total** | **15-18h** | **40% complété** |

**Temps restant estimé**: **9-12h**

---

## 🚀 Démarrage Rapide (Prochaine Session)

```bash
# 1. Installer MCP SDK
npm install @modelcontextprotocol/sdk

# 2. Créer structure serveur
mkdir -p lib/mcp/server/tools
mkdir -p bin

# 3. Créer fichiers serveur (voir détails ci-dessus)
touch lib/mcp/server/mcp-server.ts
touch lib/mcp/server/tools/analyze-cv.ts
touch lib/mcp/server/tools/get-candidates.ts
touch lib/mcp/server/middleware/auth-middleware.ts
touch bin/mcp-server.ts

# 4. Rendre exécutable
chmod +x bin/mcp-server.ts

# 5. Tester
npm run mcp:server
```

---

## ✅ Résumé

**Ce qui est prêt**:
- ✅ Auth MCP (Bearer + ApiKey)
- ✅ Consent/Masking DB
- ✅ Context Snapshot flexible
- ✅ Cache + Resilience + Quality Gating
- ✅ Migrations DB
- ✅ Tests (79/79 passés)

**Ce qui reste**:
- ⏳ Serveur MCP standalone (9-12h)
  - Tools MCP (analyze_cv, get_candidates)
  - Middleware auth
  - Tests E2E
  - Config Claude Desktop
  - Documentation

**Next step**: Installer MCP SDK et créer le serveur MCP 🚀
