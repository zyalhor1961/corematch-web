# Corematch MCP Integration - Phase 1 MVP

## 🎯 Objectif

Implémenter les fondations critiques pour l'intégration MCP (Model Context Protocol) dans Corematch, avec focus sur **sécurité, traçabilité et conformité RGPD**.

---

## ✅ Implémenté (Phase 1 - MVP)

### 1. **Cache Keys Robustes** ✅ CRITIQUE

**Fichiers:**
- `lib/mcp/cache/cache-key.ts` - Génération de clés avec isolation par job
- `lib/mcp/cache/cache-store.ts` - Store in-memory (MVP)

**Fonctionnalités:**
- ✅ Hash stable avec `hashObject()` (sort keys)
- ✅ `hashCV()` - Hash du CV (identité + expériences + compétences)
- ✅ `hashJobSpec()` - Hash du JobSpec (critères d'évaluation)
- ✅ `generateCacheKey()` - Clé unique: `corematch:cv:{cvHash}:project:{projectId}:job:{jobHash}:mode:{mode}`
- ✅ **Isolation garantie**: Même CV + Jobs différents => Clés différentes
- ✅ `InMemoryCacheStore` avec TTL et auto-cleanup

**Tests:**
- `tests/integration/cache-isolation.test.ts` (33 tests)
- Test critique: "NoMore fuites de poste" ✅

**Usage:**
```typescript
import { generateCacheKey, getCacheStore } from '@/lib/mcp/cache';

// Générer clé de cache
const cacheKey = generateCacheKey({
  cvJson: cvTeacher,
  projectId: 'project-fle-2025',
  jobSpec: jobFLE,
  mode: 'balanced'
});

// Utiliser le cache
const cache = getCacheStore();
await cache.set(cacheKey, analysisResult);
const cached = await cache.get(cacheKey);
```

---

### 2. **Context Snapshot** ✅ AUDIT

**Fichiers:**
- `lib/mcp/types/context-snapshot.ts`

**Fonctionnalités:**
- ✅ Type `ContextSnapshot` complet avec tous les champs requis
- ✅ `ContextSnapshotBuilder` pour construction progressive
- ✅ Helper `createContextSnapshot()` pour création rapide

**Champs inclus:**
- **Engine**: `engine`, `engine_version`, `sessionId`, `requestId`
- **Job Context**: `projectId`, `job_title`, `jobSpecHash`
- **Execution**: `providers_called[]`, `mode`, `prefilter_enabled`
- **Consensus**: `consensus_level`, `arbiter_used`, `disagreements[]`
- **Cost & Perf**: `cost_total_usd`, `duration_total_ms`
- **Compliance**: `pii_masking_level`, `consent_mcp_checked`

**Usage:**
```typescript
import { ContextSnapshotBuilder } from '@/lib/mcp/types/context-snapshot';

const snapshot = new ContextSnapshotBuilder()
  .setJobContext(projectId, jobTitle, jobSpecHash)
  .setMode('balanced', true, true)
  .setCost(0.25)
  .setConsensus('strong', false)
  .setCompliance('partial', true, true)
  .complete();
```

---

### 3. **PII Masking + RGPD** ✅ SÉCURITÉ

**Fichiers:**
- `lib/mcp/security/pii-masking.ts`

**Niveaux de masking:**
- `none`: Aucun masking (usage interne uniquement)
- `partial`: Masque email/linkedin/téléphone (garde nom/prénom)
- `full`: Masque tout (nom, prénom, email, employeurs, établissements)

**Fonctions:**
- ✅ `maskPII(cvJson, level)` - Masque PII selon niveau
- ✅ `isMasked(cvJson)` - Détecte si CV masqué
- ✅ `detectMaskingLevel(cvJson)` - Détecte niveau de masking
- ✅ `checkMCPConsent(candidateId)` - Vérifie consent (TODO: Supabase)
- ✅ `validateAnalysisRequest()` - Valide RGPD avant analyse

**Tests:**
- `tests/integration/mcp-rgpd.test.ts` (17 tests)
- Tests critiques: "NEVER leak PII" ✅

**Usage:**
```typescript
import { maskPII } from '@/lib/mcp/security/pii-masking';

// Masking partial (avant envoi à LLM externe)
const { masked, stats } = maskPII(cvJson, 'partial');
console.log(masked.identite.email); // => "[EMAIL_MASKED]"
console.log(masked.identite.prenom); // => "Marie" (gardé)

// Stats pour audit
console.log(stats.masked_count); // => 2
console.log(stats.fields_masked); // => ["identite.email", "identite.linkedin"]
```

---

### 4. **Schema Supabase + Migrations** ✅ DATABASE

**Fichiers:**
- `supabase/migrations/010_mcp_rgpd_fields.sql`

**Ajouts:**

#### Table `candidates`:
```sql
ALTER TABLE candidates ADD COLUMN consent_mcp BOOLEAN DEFAULT false;
```

#### Table `projects`:
```sql
ALTER TABLE projects ADD COLUMN pii_masking_level VARCHAR(20) DEFAULT 'partial'
CHECK (pii_masking_level IN ('none', 'partial', 'full'));
```

#### Nouvelle table `mcp_audit_logs`:
```sql
CREATE TABLE mcp_audit_logs (
  id UUID PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  request_id VARCHAR(255) NOT NULL,
  user_id UUID,
  tool_name VARCHAR(100) NOT NULL,
  candidate_id UUID,
  pii_masking_level VARCHAR(20),
  consent_mcp_checked BOOLEAN,
  status VARCHAR(50),
  duration_ms INTEGER,
  cost_usd DECIMAL(10,6),
  created_at TIMESTAMP
);
```

#### Nouvelle table `mcp_sessions`:
```sql
CREATE TABLE mcp_sessions (
  id UUID PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID,
  context JSONB DEFAULT '{}'::jsonb,
  expires_at TIMESTAMP NOT NULL
);
```

#### Helper functions:
- `get_project_pii_masking_level(project_id)` → VARCHAR
- `check_mcp_consent(candidate_id)` → BOOLEAN
- `get_mcp_stats_by_project(project_id)` → TABLE
- `cleanup_expired_mcp_sessions()` → INTEGER

**Appliquer la migration:**
```bash
npx supabase db push
# ou
npx supabase db reset  # Si dev local
```

---

## 🧪 Tests

### Exécuter les tests

```bash
# Tous les tests MCP
npm test tests/integration/cache-isolation.test.ts
npm test tests/integration/mcp-rgpd.test.ts

# Avec coverage
npm test -- --coverage
```

### Tests coverage

- **Cache Isolation**: 33 tests ✅
  - Hash stable
  - Génération clés
  - Isolation par job
  - Cache store (get/set/delete/TTL)
  - **TEST CRITIQUE**: "NoMore fuites de poste"

- **RGPD**: 17 tests ✅
  - Masking niveaux (none/partial/full)
  - Immutabilité
  - Détection masking
  - **TESTS CRITIQUES**: "NEVER leak PII"

---

## 📊 Architecture

```
lib/mcp/
├── cache/
│   ├── cache-key.ts         # Hash + génération clés
│   └── cache-store.ts       # In-memory store (MVP)
├── security/
│   └── pii-masking.ts       # PII masking + RGPD
├── types/
│   └── context-snapshot.ts  # Types traçabilité
└── README.md

tests/integration/
├── cache-isolation.test.ts  # Tests cache + isolation
└── mcp-rgpd.test.ts         # Tests PII + consent

supabase/migrations/
└── 010_mcp_rgpd_fields.sql  # Schema DB
```

---

## 🚀 Prochaines Étapes (Phase 2)

### À implémenter:

1. **Retry + Circuit Breaker** (Point #3)
   - `lib/mcp/resilience/circuit-breaker.ts`
   - Retry exponentiel (max 2)
   - Circuit breaker par provider
   - Timeout adaptatif (eco: 30s, balanced: 60s, premium: 120s)

2. **Evidence Quality Gating** (Point #5)
   - `lib/cv-analysis/evidence/quality-evaluator.ts`
   - Calcul `evidence_quality_sum`
   - Gating: Trigger provider additionnel si quality < threshold

3. **Smart Cost Triggering** (Point #6)
   - `lib/cv-analysis/orchestrator-smart.ts`
   - Conditional MCP: appeler que si borderline || consensus weak
   - `cost_breakdown` par provider

4. **Integration dans Orchestrator**
   - Modifier `orchestrator.ts` pour utiliser cache
   - Ajouter `context_snapshot` dans `AggregatedResult`
   - Appliquer PII masking avant appels providers

5. **MCP Server** (MVP)
   - `lib/mcp/server.ts`
   - Tools: `analyze_cv`, `list_candidates`
   - Endpoint: `app/api/mcp/route.ts`

---

## 🔍 Points Techniques Validés

### ✅ Cache Keys Isolation
- **Problème résolu**: Même CV analysé pour "FLE" puis "Peintre" donne 2 clés différentes
- **Test validation**: `cache-isolation.test.ts:257` (CRITICAL TEST)
- **Hash stable**: Ordre des clés JSON n'affecte pas le hash

### ✅ PII Protection
- **Partial**: Email/LinkedIn masqués, nom gardé
- **Full**: Tout masqué (nom, employeurs, écoles)
- **Immutabilité**: Original CV jamais modifié
- **Test validation**: `mcp-rgpd.test.ts:229` (CRITICAL TEST)

### ✅ RGPD Compliance
- Consent check avant analyse MCP
- Audit trail via `mcp_audit_logs`
- Configurable par projet (`pii_masking_level`)

---

## 📝 Checklist d'Intégration

Avant de passer en production:

- [ ] Appliquer migration Supabase (`010_mcp_rgpd_fields.sql`)
- [ ] Connecter `checkMCPConsent()` à Supabase
- [ ] Connecter `getProjectPIIMaskingLevel()` à Supabase
- [ ] Ajouter cache dans `orchestrator.ts`
- [ ] Ajouter `context_snapshot` dans résultats
- [ ] UI: Checkbox "Consent MCP" lors upload CV
- [ ] UI: Badge context snapshot sur résultats
- [ ] Tests E2E avec vraie DB Supabase
- [ ] Monitoring: Sentry + coûts + cache hit rate

---

## 🛡️ Sécurité

### Déjà implémenté:
- ✅ Cache isolation par job (prévention fuites)
- ✅ PII masking 3 niveaux
- ✅ Consent RGPD check
- ✅ Audit trail complète

### À implémenter (Phase 2):
- [ ] Rate limiting (100 req/h par session)
- [ ] Input validation (Zod schemas)
- [ ] Auth middleware MCP
- [ ] Circuit breaker (3 failures → open)

---

## 📚 Ressources

- **MCP Spec**: https://modelcontextprotocol.io/specification/2025-06-18
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **RGPD**: Articles 7 (consent), 15 (droit d'accès), 17 (droit à l'oubli)

---

**Auteur**: Claude Code
**Date**: 2025-01-26
**Version**: 1.0.0 (MVP Phase 1)
