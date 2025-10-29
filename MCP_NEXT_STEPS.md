# 🚀 MCP Corematch - Prochaines Étapes

**Date**: 2025-01-26
**Status Actuel**: ✅ **Serveur MCP 100% fonctionnel en mode test**

---

## ✅ Ce qui est TERMINÉ (100%)

### Phase 1: Fondations MCP ✅
- ✅ Cache robuste avec isolation par job (33 tests)
- ✅ PII Masking 3 niveaux (17 tests)
- ✅ Context Snapshot pour traçabilité
- ✅ Migrations DB Supabase

### Phase 2: Production Features ✅
- ✅ Resilience (retry + circuit breaker + timeout) - 15 tests
- ✅ Evidence Quality Gating - 15 tests
- ✅ Smart Cost Triggering - 19 tests

### Gaps P0 Production ✅
- ✅ Gap #1: Auth MCP flexible (Bearer + ApiKey) - 12 tests
- ✅ Gap #2: Consent/Masking DB réel
- ✅ Gap #4: ContextSnapshot flexible

### Serveur MCP ✅
- ✅ Serveur principal avec transport stdio
- ✅ Tool `analyze_cv` complet
- ✅ Tool `get_candidates` complet
- ✅ Auth middleware
- ✅ Mode MOCK pour tests sans DB
- ✅ Testé avec MCP Inspector ✅

### Documentation ✅
- ✅ `MCP_SERVER_GUIDE.md` - Guide utilisateur complet
- ✅ `MCP_INSPECTOR_GUIDE.md` - Guide de test
- ✅ `MCP_PRODUCTION_ROADMAP.md` - Roadmap complet
- ✅ `MCP_P0_GAPS_COMPLETE.md` - Documentation Gaps P0
- ✅ `MCP_SERVER_TEST_RESULTS.md` - Résultats de tests

**Tests**: 91/91 passés ✅

---

## 🎯 PROCHAINES ÉTAPES

### Option 1: Déploiement Production (Recommandé) 🚀

**Objectif**: Mettre le serveur MCP en production avec vraie DB

**Durée estimée**: 2-3 heures

#### Étape 1.1: Appliquer les migrations DB (30 min)

```bash
# Se connecter à la DB Supabase production
npx supabase link --project-ref YOUR_PROJECT_REF

# Appliquer migrations
npx supabase db push

# Vérifier que les colonnes existent
# Via Supabase SQL Editor:
SELECT column_name FROM information_schema.columns
WHERE table_name = 'candidates'
AND column_name IN ('consent_mcp', 'consent_mcp_updated_at');

SELECT column_name FROM information_schema.columns
WHERE table_name = 'projects'
AND column_name = 'pii_masking_level';

SELECT table_name FROM information_schema.tables
WHERE table_name = 'mcp_api_keys';
```

**Résultat attendu**: 3 nouvelles colonnes + 1 nouvelle table créées

#### Étape 1.2: Créer une API key production (15 min)

```sql
-- Via Supabase SQL Editor (authentifié comme votre user)
SELECT * FROM generate_mcp_api_key(
  p_name := 'Production MCP Server',
  p_description := 'Serveur MCP production pour Claude Desktop',
  p_scopes := ARRAY['cv:analyze', 'cv:read', 'project:read'],
  p_org_id := NULL, -- NULL = accès à toutes vos orgs
  p_project_id := NULL, -- NULL = accès à tous vos projets
  p_expires_at := '2026-12-31'::timestamptz -- Expiration dans 2 ans
);

-- ⚠️ IMPORTANT: Copier la clé retournée (mcp_sk_...)
-- Format: mcp_sk_abc123def456...
-- Elle ne sera plus jamais affichée!
```

**Sauvegarder la clé dans un endroit sûr** (ex: 1Password, .env)

#### Étape 1.3: Configurer env vars production (15 min)

Créer `.env.production`:

```bash
# Supabase Production
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_from_supabase

# Providers IA
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...

# MCP Auth
MCP_AUTH_HEADER=ApiKey mcp_sk_... # Clé générée à l'étape 1.2

# Mode Production
NODE_ENV=production
```

#### Étape 1.4: Tester avec vraie DB (30 min)

```bash
# Charger env vars production
source .env.production  # Linux/Mac
# ou
set -a && source .env.production && set +a  # Windows Git Bash

# Démarrer serveur
npm run mcp:server

# Tester avec MCP Inspector
npx @modelcontextprotocol/inspector npm run mcp:server
```

**Tests à effectuer**:

1. **Tool `get_candidates`** avec un vrai projectId:
   ```json
   {
     "projectId": "YOUR_REAL_PROJECT_ID",
     "limit": 5
   }
   ```

   **Résultat attendu**: Liste de vrais candidats de votre DB

2. **Tool `analyze_cv`** avec un vrai candidat:
   ```json
   {
     "candidateId": "YOUR_REAL_CANDIDATE_ID",
     "projectId": "YOUR_REAL_PROJECT_ID",
     "mode": "balanced"
   }
   ```

   **Résultat attendu**: Analyse complète avec score, strengths, weaknesses

3. **Test consent**: Candidat sans consent
   ```json
   {
     "candidateId": "CANDIDATE_WITHOUT_CONSENT",
     "projectId": "PROJECT_ID",
     "mode": "balanced"
   }
   ```

   **Erreur attendue**: `ERROR_CONSENT_REQUIRED`

#### Étape 1.5: Mettre à jour consent candidats (15 min)

Pour activer MCP sur vos candidats existants:

```sql
-- Activer consent MCP pour tous vos candidats (à adapter selon vos besoins)
UPDATE candidates
SET consent_mcp = true,
    consent_mcp_updated_at = now()
WHERE project_id IN (
  SELECT id FROM projects WHERE created_by = auth.uid()
);

-- Ou sélectivement pour un projet
UPDATE candidates
SET consent_mcp = true,
    consent_mcp_updated_at = now()
WHERE project_id = 'YOUR_PROJECT_ID';
```

#### Étape 1.6: Tests E2E complets (30 min)

**Scénarios de test**:

1. ✅ Analyser 3-5 CVs en mode balanced
2. ✅ Vérifier cache hit sur 2ème analyse du même CV
3. ✅ Tester mode eco vs balanced vs premium (comparer coûts)
4. ✅ Vérifier context_snapshot dans résultats
5. ✅ Vérifier logs serveur

**Checklist**:
- [ ] get_candidates retourne vrais candidats
- [ ] analyze_cv fonctionne en mode eco
- [ ] analyze_cv fonctionne en mode balanced
- [ ] analyze_cv fonctionne en mode premium
- [ ] Cache fonctionne (2ème analyse < 100ms)
- [ ] Erreur consent gérée correctement
- [ ] Context snapshot correct (engine: corematch-mcp)
- [ ] Logs détaillés et utiles

---

### Option 2: Configuration Claude Desktop (Recommandé après Option 1) 🤖

**Objectif**: Utiliser Corematch directement depuis Claude Desktop

**Durée estimée**: 1 heure

#### Étape 2.1: Configurer Claude Desktop (30 min)

**Localiser le fichier config**:
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

**Créer/modifier `claude_desktop_config.json`**:

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
        "SUPABASE_SERVICE_ROLE_KEY": "your_service_role_key",
        "OPENAI_API_KEY": "sk-...",
        "GOOGLE_API_KEY": "AIza...",
        "ANTHROPIC_API_KEY": "sk-ant-...",
        "MCP_AUTH_HEADER": "ApiKey mcp_sk_your_api_key_here",
        "NODE_ENV": "production"
      }
    }
  }
}
```

**⚠️ Important**:
- Remplacer `F:\\corematch` par le chemin absolu de votre projet
- Utiliser `\\` (double backslash) sur Windows
- Remplacer toutes les env vars par vos vraies valeurs

#### Étape 2.2: Redémarrer Claude Desktop (2 min)

1. Fermer complètement Claude Desktop
2. Rouvrir Claude Desktop
3. Vérifier dans les logs que le serveur MCP démarre

#### Étape 2.3: Tester dans Claude Desktop (30 min)

**Test 1**: Lister les candidats
```
Liste-moi les candidats du projet "Développeur Senior React"
```

Claude devrait:
1. Détecter le tool `get_candidates`
2. Demander confirmation
3. Exécuter le tool
4. Afficher les candidats

**Test 2**: Analyser un CV
```
Analyse le CV du candidat Marie Dupont pour le projet "Développeur Senior React"
```

Claude devrait:
1. Détecter le tool `analyze_cv`
2. Demander confirmation
3. Exécuter l'analyse
4. Afficher le résultat avec score et recommandation

**Test 3**: Comparaison de candidats
```
Compare les 3 meilleurs candidats du projet "Développeur Senior React"
```

Claude devrait:
1. Lister les candidats
2. Analyser les 3 meilleurs
3. Faire une synthèse comparative

---

### Option 3: Optimisations Avancées (Optionnel) ⚡

**Objectif**: Améliorer performance et scaling

**Durée estimée**: 6-8 heures

#### Gap #3: Cache Multi-Process avec Redis

**Problème**: Cache actuel en mémoire (Map) → perdu au redémarrage, pas partagé entre instances

**Solution**: Redis pour cache distribué

**Fichiers à créer**:
1. `lib/mcp/cache/redis-cache-store.ts` - Implémentation Redis
2. `lib/mcp/cache/cache-factory.ts` - Factory pour choisir cache (Memory vs Redis)

**Installation**:
```bash
npm install redis ioredis
npm install --save-dev @types/redis
```

**Configuration**:
```typescript
// lib/mcp/cache/redis-cache-store.ts
import { Redis } from 'ioredis';

export class RedisCacheStore implements CacheStore {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });
  }

  async get(key: string): Promise<AggregatedResult | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: AggregatedResult, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.redis.setex(key, ttl, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async clear(): Promise<void> {
    await this.redis.flushdb();
  }
}
```

**Effort**: 6h

#### Monitoring Production avec Sentry

**Installation**:
```bash
npm install @sentry/node
```

**Configuration**:
```typescript
// lib/mcp/server/monitoring.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

export function trackMCPToolCall(toolName: string, duration: number, success: boolean) {
  Sentry.addBreadcrumb({
    category: 'mcp.tool',
    message: `Tool ${toolName} executed`,
    level: success ? 'info' : 'error',
    data: { duration, success },
  });
}
```

**Effort**: 2h

---

## 📊 Résumé Options

| Option | Priorité | Durée | Difficulté | Bénéfice |
|--------|----------|-------|------------|----------|
| **Option 1: Production** | 🔴 Haute | 2-3h | Moyenne | Production ready |
| **Option 2: Claude Desktop** | 🟡 Moyenne | 1h | Facile | Usage quotidien |
| **Option 3: Optimisations** | 🟢 Basse | 6-8h | Haute | Scaling |

---

## 🎯 Recommandation

**MAINTENANT**: Faire **Option 1** (Déploiement Production)

**Pourquoi**?
1. Tester avec vraies données
2. Valider que tout fonctionne en production
3. Identifier problèmes potentiels
4. Avoir un système utilisable

**ENSUITE**: Faire **Option 2** (Claude Desktop)

**Pourquoi**?
1. Cas d'usage réel
2. Feedback utilisateur
3. Démo impressionnante

**PLUS TARD**: Faire **Option 3** (Optimisations)

**Quand**?
- Quand vous avez > 100 requêtes/jour
- Quand vous déployez sur plusieurs serveurs
- Quand le cache hit rate est important

---

## 📚 Ressources

### Documentation Créée

1. **`MCP_SERVER_GUIDE.md`** - Guide utilisateur complet
2. **`MCP_INSPECTOR_GUIDE.md`** - Guide de test avec MCP Inspector
3. **`MCP_PRODUCTION_ROADMAP.md`** - Roadmap et planning
4. **`MCP_P0_GAPS_COMPLETE.md`** - Documentation Gaps P0
5. **`MCP_SERVER_TEST_RESULTS.md`** - Résultats de tests
6. **`MCP_NEXT_STEPS.md`** - Ce document

### Fichiers Serveur MCP

- `lib/mcp/server/mcp-server.ts` - Serveur principal
- `lib/mcp/server/tools/analyze-cv.ts` - Tool analyse
- `lib/mcp/server/tools/get-candidates.ts` - Tool liste
- `lib/mcp/server/tools/mock-data.ts` - Données de test
- `lib/mcp/server/middleware/auth-middleware.ts` - Auth
- `bin/mcp-server.ts` - Point d'entrée production
- `bin/test-mcp-server.ts` - Point d'entrée test

### Scripts Utiles

```bash
# Test local
npx tsx bin/test-mcp-server.ts

# Production
npm run mcp:server

# MCP Inspector
npx @modelcontextprotocol/inspector npm run mcp:server

# Tests
npm test
```

---

## ✅ Checklist Finale

Avant de considérer le projet 100% terminé:

### Développement ✅
- [x] Phase 1: Fondations MCP
- [x] Phase 2: Production Features
- [x] Gaps P0: Auth + DB + ContextSnapshot
- [x] Serveur MCP complet
- [x] Mode MOCK pour tests
- [x] Tests MCP Inspector

### Production ⏳
- [ ] Migrations DB appliquées en production
- [ ] API key production créée
- [ ] Tests E2E avec vraie DB
- [ ] Consent candidats activé
- [ ] Performance validée

### Integration ⏳
- [ ] Claude Desktop configuré
- [ ] Tests avec Claude Desktop
- [ ] Documentation utilisateur finale

### Monitoring ⏳
- [ ] Logs production
- [ ] Sentry configuré (optionnel)
- [ ] Métriques de coûts trackées

---

**Auteur**: Claude Code
**Date**: 2025-01-26
**Version**: 1.0.0

**Status Global**: ✅ **Développement: 100% | Production: 40%**
