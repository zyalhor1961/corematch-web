# 🔴 MCP - Gaps Production à Combler

**Date**: 2025-01-26
**Status**: ⚠️ **4 GAPS CRITIQUES IDENTIFIÉS**
**Priorité**: 🔴 **BLOQUANT PRODUCTION MCP**

---

## 📊 Résumé Exécutif

L'implémentation MCP Phase 1 + Phase 2 est **techniquement complète** (98/98 tests passent), **MAIS** il reste **4 gaps critiques** avant de pouvoir utiliser MCP en production:

| # | Gap | Criticité | Effort | Bloquant Prod? |
|---|-----|-----------|--------|----------------|
| 1 | Auth NextRequest-dépendante | 🔴 CRITIQUE | 4h | ✅ OUI |
| 2 | Consent/Masking stubs | 🔴 CRITIQUE | 2h | ✅ OUI |
| 3 | Cache mono-processus | 🟡 MOYEN | 6h | ⚠️ SI MULTI-INSTANCES |
| 4 | ContextSnapshot hardcodé | 🟡 MOYEN | 1h | ⚠️ OUI |

**Total effort**: ~13h pour rendre MCP production-ready

---

## 🔴 GAP #1: Auth NextRequest-dépendante

### Problème

**Fichier**: `lib/auth/verify-auth.ts:10`

```typescript
export async function verifyAuth(request: NextRequest): Promise<AuthUser | null>
```

L'authentification actuelle est **couplée à NextRequest**, ce qui pose problème pour:
- ✅ Routes API Next.js → OK
- ❌ Serveur MCP standalone → **BLOQUÉ**
- ❌ CLI tools → **BLOQUÉ**
- ❌ Workers/Background jobs → **BLOQUÉ**

### Impact

**Criticité**: 🔴 **CRITIQUE - BLOQUANT PRODUCTION MCP**

Si on veut exposer MCP comme serveur autonome, on ne peut pas utiliser `verifyAuth()` actuel.

### Solution Recommandée

**Option A: Dual Auth System (Recommandé)**

Créer `lib/auth/mcp-auth.ts` avec stratégies multiples:

```typescript
/**
 * MCP Auth - Indépendant de Next.js
 */

export type MCPAuthStrategy =
  | 'api-key'      // Clé API interne
  | 'supabase'     // Token Supabase direct
  | 'jwt';         // JWT custom

export interface MCPAuthContext {
  userId: string;
  organizationId: string;
  permissions: string[];
  strategy: MCPAuthStrategy;
}

/**
 * Vérifier auth MCP depuis:
 * - Header Authorization: Bearer <token>
 * - Header X-API-Key: <key>
 */
export async function verifyMCPAuth(
  headers: Record<string, string>
): Promise<MCPAuthContext | null> {
  // 1. Try API Key
  const apiKey = headers['x-api-key'];
  if (apiKey) {
    return verifyAPIKey(apiKey);
  }

  // 2. Try Supabase Token
  const authHeader = headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return verifySupabaseToken(token);
  }

  return null;
}

async function verifyAPIKey(key: string): Promise<MCPAuthContext | null> {
  // Vérifier clé API en DB
  const { data } = await supabaseAdmin
    .from('mcp_api_keys')
    .select('user_id, organization_id, permissions')
    .eq('key_hash', hashAPIKey(key))
    .eq('active', true)
    .single();

  if (!data) return null;

  return {
    userId: data.user_id,
    organizationId: data.organization_id,
    permissions: data.permissions,
    strategy: 'api-key',
  };
}

async function verifySupabaseToken(token: string): Promise<MCPAuthContext | null> {
  // Vérifier token Supabase directement
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) return null;

  return {
    userId: user.id,
    organizationId: user.user_metadata.organization_id,
    permissions: ['read', 'write'],
    strategy: 'supabase',
  };
}
```

**Avantages**:
- ✅ Compatible Next.js routes (garder `verifyAuth`)
- ✅ Compatible serveur MCP (utiliser `verifyMCPAuth`)
- ✅ Flexible (plusieurs stratégies)
- ✅ Pas de breaking changes

**Effort**: ~4h
- 2h: Implémentation
- 1h: Tests
- 1h: Migration table `mcp_api_keys`

**Option B: Refactor complet**

Remplacer `verifyAuth(NextRequest)` par `verifyAuth(headers)` partout.

**Avantages**:
- ✅ Une seule fonction d'auth

**Inconvénients**:
- ❌ Breaking changes partout
- ❌ Effort énorme (~12h)

### Recommandation

**→ Option A (Dual Auth)** pour isoler MCP sans casser l'existant.

### Migration DB Nécessaire

```sql
-- Table pour stocker les clés API MCP
CREATE TABLE mcp_api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL, -- "Production Server", "Dev CLI", etc.
  key_hash TEXT NOT NULL UNIQUE, -- Hash SHA-256 de la clé

  permissions TEXT[] DEFAULT ARRAY['read'], -- ['read', 'write', 'admin']

  active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- NULL = jamais

  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_mcp_api_keys_key_hash ON mcp_api_keys(key_hash);
CREATE INDEX idx_mcp_api_keys_user ON mcp_api_keys(user_id);
CREATE INDEX idx_mcp_api_keys_org ON mcp_api_keys(organization_id);
```

---

## 🔴 GAP #2: Consent/Masking Stubs

### Problème

**Fichiers**:
- `lib/mcp/security/pii-masking.ts:164` - `checkMCPConsent`
- `lib/mcp/security/pii-masking.ts:185` - `updateMCPConsent`
- `lib/mcp/security/pii-masking.ts:200` - `getProjectPIIMaskingLevel`

**Code actuel (STUB)**:

```typescript
export async function checkMCPConsent(candidateId: string): Promise<boolean> {
  // TODO: Implémenter avec Supabase
  console.warn('[checkMCPConsent] Not implemented yet, returning false');
  return false; // ❌ TOUJOURS FALSE
}

export async function getProjectPIIMaskingLevel(projectId: string): Promise<PIIMaskingLevel> {
  console.warn('[getProjectPIIMaskingLevel] Not implemented yet, returning "partial"');
  return 'partial'; // ❌ TOUJOURS PARTIAL
}
```

### Impact

**Criticité**: 🔴 **CRITIQUE - VIOLATION RGPD**

- ❌ **checkMCPConsent** retourne toujours `false` → On n'utilise JAMAIS MCP (même si candidat consent)
- ❌ **getProjectPIIMaskingLevel** retourne toujours `partial` → Configuration projet ignorée
- ⚠️ **Risque RGPD**: Si on utilise MCP sans vérifier consent réel = **VIOLATION**

### Solution Recommandée

**Implémenter les 3 fonctions avec Supabase**

```typescript
import { createClient } from '@supabase/supabase-js';

// Utiliser supabaseAdmin (service role)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚠️ Service role pour bypass RLS
);

/**
 * Vérifier le consent MCP d'un candidat
 */
export async function checkMCPConsent(candidateId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('candidates')
      .select('consent_mcp')
      .eq('id', candidateId)
      .single();

    if (error) {
      console.error('[checkMCPConsent] Error:', error);
      return false; // Fail-safe: pas de consent en cas d'erreur
    }

    return data?.consent_mcp === true;
  } catch (err) {
    console.error('[checkMCPConsent] Exception:', err);
    return false;
  }
}

/**
 * Mettre à jour le consent MCP d'un candidat
 */
export async function updateMCPConsent(
  candidateId: string,
  consent: boolean
): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('candidates')
      .update({
        consent_mcp: consent,
        consent_mcp_updated_at: new Date().toISOString(),
      })
      .eq('id', candidateId);

    if (error) {
      console.error('[updateMCPConsent] Error:', error);
      throw new Error(`Failed to update MCP consent: ${error.message}`);
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      entity_type: 'candidate',
      entity_id: candidateId,
      action: consent ? 'mcp_consent_granted' : 'mcp_consent_revoked',
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[updateMCPConsent] Exception:', err);
    throw err;
  }
}

/**
 * Obtenir le niveau de masking PII d'un projet
 */
export async function getProjectPIIMaskingLevel(
  projectId: string
): Promise<PIIMaskingLevel> {
  try {
    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('pii_masking_level')
      .eq('id', projectId)
      .single();

    if (error) {
      console.error('[getProjectPIIMaskingLevel] Error:', error);
      return 'partial'; // Défaut sécurisé
    }

    const level = data?.pii_masking_level as PIIMaskingLevel;

    // Validation
    if (!['none', 'partial', 'full'].includes(level)) {
      console.warn(`[getProjectPIIMaskingLevel] Invalid level "${level}", using "partial"`);
      return 'partial';
    }

    return level;
  } catch (err) {
    console.error('[getProjectPIIMaskingLevel] Exception:', err);
    return 'partial';
  }
}
```

**Effort**: ~2h
- 1h: Implémentation
- 0.5h: Tests
- 0.5h: Vérifier migrations DB (colonnes existent déjà)

### Migration DB Nécessaire

**Vérifier que les colonnes existent**:

```sql
-- Colonne consent_mcp sur candidates (normalement déjà là)
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS consent_mcp BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_mcp_updated_at TIMESTAMPTZ;

-- Colonne pii_masking_level sur projects (normalement déjà là)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS pii_masking_level TEXT DEFAULT 'partial'
  CHECK (pii_masking_level IN ('none', 'partial', 'full'));

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_candidates_consent_mcp
  ON candidates(consent_mcp) WHERE consent_mcp = true;
```

---

## 🟡 GAP #3: Cache Mono-Processus

### Problème

**Fichier**: `lib/mcp/cache/cache-store.ts:36`

```typescript
/**
 * In-Memory Cache Store (MVP)
 *
 * ⚠️ LIMITATIONS:
 * - Perdu au restart serveur
 * - Ne scale pas horizontalement (multi-instances)
 * - Pas de persistence
 */
export class InMemoryCacheStore implements CacheStore {
  private store: Map<string, CacheEntry>;
  // ...
}
```

### Impact

**Criticité**: 🟡 **MOYEN - BLOQUANT SI MULTI-INSTANCES**

| Scénario | Impact |
|----------|--------|
| **1 instance Next.js** (Vercel single region) | ✅ OK - Cache fonctionne |
| **Multi-instances** (Vercel edge/multi-region) | ❌ Cache fragmenté (chaque instance a son cache) |
| **Horizontal scaling** (K8s, plusieurs pods) | ❌ Pas de cache partagé |
| **Serverless** (Lambda, Cloud Run) | ❌ Cache perdu à chaque cold start |

**Taux de cache hit effectif en multi-instances**:
```
Single instance: 50-60% hit rate
3 instances:     ~20% hit rate (cache fragmenté)
10 instances:    ~5% hit rate (quasi inutile)
```

### Solution Recommandée

**Option A: Redis (Recommandé pour Production)**

```typescript
import { Redis } from '@upstash/redis';

export class RedisCacheStore implements CacheStore {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  async get(key: string): Promise<AggregatedResult | null> {
    const value = await this.redis.get<AggregatedResult>(key);
    return value || null;
  }

  async set(key: string, value: AggregatedResult, ttlSeconds = 3600): Promise<void> {
    await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
  }

  async has(key: string): Promise<boolean> {
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async delete(key: string): Promise<boolean> {
    const deleted = await this.redis.del(key);
    return deleted === 1;
  }

  async clear(): Promise<void> {
    // ATTENTION: Supprime TOUT le cache
    await this.redis.flushdb();
  }

  async size(): Promise<number> {
    const keys = await this.redis.keys('corematch:*');
    return keys.length;
  }
}
```

**Avantages**:
- ✅ Cache partagé entre instances
- ✅ Persistence (survit aux restarts)
- ✅ TTL natif
- ✅ Upstash = serverless-friendly (pas de infra à gérer)
- ✅ Coût bas (~$10-20/mois pour 1M requêtes)

**Inconvénients**:
- ❌ Dépendance externe
- ❌ Latence réseau (~10-50ms vs <1ms in-memory)

**Effort**: ~6h
- 3h: Implémentation RedisCacheStore
- 2h: Tests
- 1h: Setup Upstash + env vars

**Option B: Supabase Storage (Alternative)**

Stocker le cache dans une table Supabase:

```sql
CREATE TABLE mcp_cache (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mcp_cache_expires ON mcp_cache(expires_at);
```

**Avantages**:
- ✅ Pas de service externe supplémentaire
- ✅ Déjà dans notre stack

**Inconvénients**:
- ❌ Plus lent que Redis (~50-100ms)
- ❌ Coût DB plus élevé

### Recommandation

**→ Redis (Upstash)** pour production multi-instances.

**→ Garder InMemory** pour dev/test.

**Pattern Factory**:

```typescript
// lib/mcp/cache/cache-store.ts
export function createCacheStore(): CacheStore {
  const cacheType = process.env.MCP_CACHE_TYPE || 'memory';

  switch (cacheType) {
    case 'redis':
      return new RedisCacheStore();
    case 'supabase':
      return new SupabaseCacheStore();
    case 'memory':
    default:
      return new InMemoryCacheStore();
  }
}
```

---

## 🟡 GAP #4: ContextSnapshot Hardcodé

### Problème

**Fichiers**:
- `lib/cv-analysis/orchestrator.ts:420`
- `lib/mcp/types/context-snapshot.ts:184`

```typescript
// orchestrator.ts
const contextBuilder = new ContextSnapshotBuilder();
contextBuilder.setEngine('corematch-v2', '2.0.0'); // ❌ Hardcodé
// ...
contextBuilder.setConsent(false); // ❌ Toujours false
```

```typescript
// context-snapshot.ts
export class ContextSnapshotBuilder {
  private snapshot: Partial<ContextSnapshot> = {
    engine: 'corematch-v2', // ❌ Hardcodé
    consent_mcp_checked: false, // ❌ Hardcodé
  };
}
```

### Impact

**Criticité**: 🟡 **MOYEN - MANQUE DE FLEXIBILITÉ**

Quand on appelle depuis:
- ✅ Routes API Next.js → OK (`corematch-v2`)
- ❌ Serveur MCP → Devrait être `corematch-mcp`
- ❌ CLI tool → Devrait être `corematch-cli`

Le `consent_mcp_checked` est toujours `false` même si on a vérifié.

### Solution Recommandée

**Rendre le builder flexible**:

```typescript
export class ContextSnapshotBuilder {
  private snapshot: Partial<ContextSnapshot>;

  constructor(engine: 'corematch-v2' | 'corematch-mcp' | 'corematch-cli' = 'corematch-v2') {
    this.snapshot = {
      engine,
      engine_version: '2.0.0',
      sessionId: uuidv4(),
      consent_mcp_checked: false, // Sera mis à jour par setConsent()
    };
  }

  /**
   * Définir le consentement MCP
   */
  setConsent(checked: boolean, candidateId?: string): this {
    this.snapshot.consent_mcp_checked = checked;
    if (candidateId) {
      this.snapshot.candidate_id = candidateId;
    }
    return this;
  }

  // ...
}
```

**Dans orchestrator**:

```typescript
export async function orchestrateAnalysis(
  cvText: string,
  jobSpec: JobSpec,
  options: OrchestrationOptions
) {
  // Déterminer l'engine selon le contexte
  const engine = options.engine || 'corematch-v2';

  const contextBuilder = new ContextSnapshotBuilder(engine);

  // Vérifier consent si candidateId fourni
  if (options.candidateId) {
    const hasConsent = await checkMCPConsent(options.candidateId);
    contextBuilder.setConsent(hasConsent, options.candidateId);

    if (!hasConsent && engine === 'corematch-mcp') {
      throw new Error(`Candidate ${options.candidateId} has not granted MCP consent`);
    }
  }

  // ...
}
```

**Effort**: ~1h
- 0.5h: Modifications
- 0.5h: Tests

---

## 📋 Plan d'Action Recommandé

### Phase "Production-Ready MCP" (~13h)

| Priority | Gap | Effort | Ordre |
|----------|-----|--------|-------|
| 🔴 P0 | #2 - Consent/Masking stubs | 2h | **1ER** (RGPD!) |
| 🔴 P0 | #4 - ContextSnapshot hardcodé | 1h | **2ÈME** (Quick win) |
| 🔴 P0 | #1 - Auth MCP | 4h | **3ÈME** (Bloquant server) |
| 🟡 P1 | #3 - Cache Redis | 6h | **4ÈME** (Si multi-instances) |

### Timeline Suggéré

**Week 1 (P0 - Bloquants RGPD/Auth)**
- Jour 1-2: Gap #2 - Implémenter consent/masking (2h)
- Jour 2: Gap #4 - Rendre ContextSnapshot flexible (1h)
- Jour 3-4: Gap #1 - Auth MCP (4h)
- **→ À la fin: MCP utilisable en single-instance**

**Week 2 (P1 - Scaling)**
- Jour 5-7: Gap #3 - Implémenter Redis cache (6h)
- **→ À la fin: MCP production-ready multi-instances**

### Tests à Ajouter

```typescript
// tests/integration/mcp-production-ready.test.ts
describe('MCP Production Readiness', () => {
  describe('Gap #1: Auth', () => {
    it('should verify API key auth', async () => {
      const auth = await verifyMCPAuth({ 'x-api-key': 'test-key' });
      expect(auth).not.toBeNull();
    });

    it('should verify Supabase token auth', async () => {
      const auth = await verifyMCPAuth({
        'authorization': 'Bearer supabase-token'
      });
      expect(auth).not.toBeNull();
    });
  });

  describe('Gap #2: Consent', () => {
    it('should check real MCP consent from DB', async () => {
      const hasConsent = await checkMCPConsent('candidate-id');
      expect(typeof hasConsent).toBe('boolean');
    });

    it('should get real masking level from project', async () => {
      const level = await getProjectPIIMaskingLevel('project-id');
      expect(['none', 'partial', 'full']).toContain(level);
    });
  });

  describe('Gap #3: Cache', () => {
    it('should work with Redis cache', async () => {
      const cache = createCacheStore(); // Redis
      await cache.set('test-key', mockResult);
      const retrieved = await cache.get('test-key');
      expect(retrieved).toEqual(mockResult);
    });
  });

  describe('Gap #4: ContextSnapshot', () => {
    it('should support different engines', () => {
      const mcpBuilder = new ContextSnapshotBuilder('corematch-mcp');
      expect(mcpBuilder.snapshot.engine).toBe('corematch-mcp');
    });

    it('should track real consent status', async () => {
      const builder = new ContextSnapshotBuilder();
      builder.setConsent(true, 'candidate-id');
      expect(builder.snapshot.consent_mcp_checked).toBe(true);
    });
  });
});
```

---

## ✅ Checklist Production MCP

Avant de déployer MCP en production, vérifier:

### Sécurité & RGPD
- [ ] **Gap #2**: Consent/Masking implémentés (CRITIQUE)
- [ ] Audit logs pour consent updates
- [ ] PII masking respecte config projet
- [ ] Tests RGPD passent (18/18)

### Auth & Permissions
- [ ] **Gap #1**: Auth MCP indépendant de Next.js
- [ ] Table `mcp_api_keys` créée
- [ ] Génération/révocation clés API fonctionne
- [ ] Rate limiting sur endpoints MCP

### Performance & Scaling
- [ ] **Gap #3**: Cache Redis si multi-instances
- [ ] Cache hit rate > 40% en production
- [ ] Monitoring métriques cache (hits/misses)

### Traçabilité
- [ ] **Gap #4**: ContextSnapshot flexible
- [ ] Engine correct selon contexte
- [ ] Consent status tracé
- [ ] Logs centralisés

### Tests
- [ ] Tests production-ready passent (12/12 nouveau)
- [ ] Load testing MCP server
- [ ] Chaos testing (Redis down, etc.)

---

## 💡 Conclusion

### Ce qui est PRÊT ✅

- ✅ Architecture MCP solide (98/98 tests passent)
- ✅ Cache intelligent avec isolation
- ✅ PII masking (logique OK, juste stubs à remplacer)
- ✅ Resilience complète
- ✅ Quality gating
- ✅ Cost optimization

### Ce qui BLOQUE Production ❌

- ❌ **Gap #2**: Consent/Masking = **VIOLATION RGPD** si utilisé tel quel
- ❌ **Gap #1**: Auth = **Impossible de déployer serveur MCP autonome**
- ⚠️ **Gap #3**: Cache = **Ne scale pas** en multi-instances
- ⚠️ **Gap #4**: ContextSnapshot = **Manque flexibilité**

### Effort Total

**13h** pour combler tous les gaps et rendre MCP production-ready.

### Recommandation Finale

**NE PAS** déployer MCP en production avant d'avoir corrigé au minimum:
1. ✅ Gap #2 (Consent/Masking) - **CRITIQUE RGPD**
2. ✅ Gap #1 (Auth MCP) - **BLOQUANT serveur**
3. ✅ Gap #4 (ContextSnapshot) - **Quick fix**

Le Gap #3 (Redis) peut être différé SI on reste en single-instance.

**Timeline réaliste**: 1 semaine pour P0, 2 semaines pour tout combler.

---

**Dernière mise à jour**: 2025-01-26
**Prochaine révision**: Après implémentation des gaps P0
