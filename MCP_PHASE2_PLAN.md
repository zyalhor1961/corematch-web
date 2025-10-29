# 🚀 MCP Phase 2 - Plan d'Implémentation

**Date**: 2025-01-26
**Durée estimée**: 12h (3 points × 4h)
**Points à implémenter**: #3, #5, #6

---

## 📋 Vue d'Ensemble

La Phase 2 ajoute la **résilience**, la **qualité des preuves** et l'**optimisation des coûts** au système MCP.

### Points à Implémenter

| # | Point | Fichier Principal | Effort | Priorité |
|---|-------|-------------------|--------|----------|
| 3 | **Retry + Circuit Breaker** | `lib/mcp/resilience/circuit-breaker.ts` | 4h | Haute |
| 5 | **Evidence Quality Gating** | `lib/cv-analysis/evidence/quality-evaluator.ts` | 4h | Moyenne |
| 6 | **Smart Cost Triggering** | `lib/cv-analysis/orchestrator-smart.ts` | 4h | Haute |

---

## 🔄 Point #3: Retry + Circuit Breaker

### Objectif
Rendre les appels LLM **résilients** aux erreurs transitoires et protéger contre les cascades de failures.

### Spécifications

#### 1. Retry avec Exponential Backoff
```typescript
interface RetryConfig {
  maxRetries: number;        // 2 max
  initialDelayMs: number;    // 1000ms
  maxDelayMs: number;        // 10000ms
  backoffMultiplier: number; // 2
  retryableErrors: string[]; // ['ECONNRESET', 'ETIMEDOUT', '429', '500', '502', '503']
}
```

**Comportement**:
- Retry 1: Attendre 1s
- Retry 2: Attendre 2s
- Retry 3+: Pas de retry, fail

#### 2. Circuit Breaker par Provider
```typescript
interface CircuitBreakerConfig {
  failureThreshold: number;  // 3 failures → open
  successThreshold: number;  // 2 success → close
  timeoutMs: number;         // 30000ms
  halfOpenRetryMs: number;   // 60000ms (1 min)
}

type CircuitState = 'closed' | 'open' | 'half-open';
```

**États**:
- **Closed**: Normal, tous les appels passent
- **Open**: Circuit ouvert, rejette immédiatement (pas d'appel API)
- **Half-Open**: Test avec 1 appel, puis decide close/open

**Par Provider**:
- Circuit breaker OpenAI indépendant
- Circuit breaker Gemini indépendant
- Circuit breaker Claude indépendant

#### 3. Timeout Adaptatif
```typescript
const TIMEOUTS = {
  eco: 30_000,      // 30s
  balanced: 60_000, // 60s
  premium: 120_000, // 120s
};
```

### Structure des Fichiers

```
lib/mcp/resilience/
├── circuit-breaker.ts       # Circuit breaker state machine
├── retry.ts                 # Retry logic avec backoff
├── timeout.ts               # Timeout adaptatif
└── index.ts                 # Exports
```

### Interface Publique

```typescript
// Circuit Breaker
export class CircuitBreaker {
  constructor(config: CircuitBreakerConfig);
  async execute<T>(fn: () => Promise<T>): Promise<T>;
  getState(): CircuitState;
  getStats(): { failures: number; successes: number; state: CircuitState };
  reset(): void;
}

// Retry
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<T>;

// Timeout
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T>;

// Combiné (tout en un)
export async function resilientCall<T>(
  fn: () => Promise<T>,
  options: {
    retryConfig?: RetryConfig;
    circuitBreaker?: CircuitBreaker;
    timeoutMs?: number;
  }
): Promise<T>;
```

### Intégration dans Providers

```typescript
// lib/cv-analysis/providers/openai-provider.ts

import { resilientCall, CircuitBreaker } from '@/lib/mcp/resilience';

const openaiCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  successThreshold: 2,
  timeoutMs: 30000,
  halfOpenRetryMs: 60000,
});

export function createOpenAIProvider() {
  return {
    async analyze(cvJson: CV_JSON, jobSpec: JobSpec) {
      return resilientCall(
        () => callOpenAI(cvJson, jobSpec),
        {
          circuitBreaker: openaiCircuitBreaker,
          timeoutMs: 30000,
          retryConfig: {
            maxRetries: 2,
            initialDelayMs: 1000,
            maxDelayMs: 10000,
            backoffMultiplier: 2,
            retryableErrors: ['ECONNRESET', 'ETIMEDOUT', '429', '500', '502', '503'],
          },
        }
      );
    },
  };
}
```

### Tests Requis

1. ✅ Retry sur erreur transitoire (3 tests)
2. ✅ Circuit breaker open après 3 failures (2 tests)
3. ✅ Circuit breaker half-open → closed après success (2 tests)
4. ✅ Timeout respecté (2 tests)
5. ✅ Exponential backoff correct (2 tests)

**Total**: ~12 tests

---

## 📊 Point #5: Evidence Quality Gating

### Objectif
**Détecter** quand les preuves d'expérience sont **faibles** et déclencher automatiquement un provider additionnel pour plus de précision.

### Spécifications

#### 1. Calcul Evidence Quality

Pour chaque expérience pertinente (direct/adjacent):

```typescript
interface ExperienceEvidence {
  experience_index: number;
  relevance: 'direct' | 'adjacent';
  evidence_quality: 0 | 1 | 2; // 0 = weak, 1 = medium, 2 = strong
  reason: string;
}

// Critères de qualité
const QUALITY_CRITERIA = {
  strong: {
    keywords_match: 3+,        // 3+ mots-clés du job trouvés
    duration_months: 12+,      // 1+ an
    description_length: 100+,  // Description détaillée
    skills_mentioned: 2+,      // Skills explicites
  },
  medium: {
    keywords_match: 1-2,
    duration_months: 6-11,
    description_length: 50-99,
    skills_mentioned: 1,
  },
  weak: {
    keywords_match: 0,
    duration_months: <6,
    description_length: <50,
    skills_mentioned: 0,
  },
};
```

#### 2. Evidence Quality Sum

```typescript
interface EvidenceQualityMetrics {
  total_relevant_experiences: number;
  evidence_quality_sum: number; // Somme des scores (0-2 par exp)
  average_evidence_quality: number; // Moyenne
  weak_evidence_count: number;
  medium_evidence_count: number;
  strong_evidence_count: number;
}

// Seuils de gating
const EVIDENCE_THRESHOLDS = {
  needs_more_provider: {
    average_quality: 1.0,     // Si moyenne < 1.0
    weak_count: 2,            // OU si 2+ preuves faibles
    total_sum: 3,             // OU si somme < 3
  },
};
```

#### 3. Integration dans NeedsMore

```typescript
export interface UncertaintyTriggers {
  borderline_score: boolean;
  weak_evidence: boolean;        // ✅ NOUVEAU
  score_divergence: boolean;
  must_have_uncertain: boolean;
  vip_candidate: boolean;
}

export interface NeedsMoreAnalysis {
  needs_more: boolean;
  triggers: UncertaintyTriggers;
  confidence: number;
  recommended_providers: ProviderName[];
  evidence_quality?: EvidenceQualityMetrics; // ✅ NOUVEAU
}
```

### Structure des Fichiers

```
lib/cv-analysis/evidence/
├── quality-evaluator.ts     # Calcul evidence quality
├── types.ts                 # Types evidence
└── index.ts                 # Exports
```

### Interface Publique

```typescript
export function evaluateEvidenceQuality(
  cvJson: CV_JSON,
  jobSpec: JobSpec,
  relevanceResults: RelevanceResult[]
): EvidenceQualityMetrics;

export function shouldTriggerExtraProvider(
  metrics: EvidenceQualityMetrics
): boolean;
```

### Intégration dans Orchestrator

```typescript
// Dans orchestrateAnalysis(), après évaluation provider principal

// Évaluer qualité des preuves
const evidenceMetrics = evaluateEvidenceQuality(cvJson, jobSpec, relevanceResults);

// Décider si besoin de provider additionnel
const needsMore = {
  needs_more: shouldTriggerExtraProvider(evidenceMetrics) || borderlineScore,
  triggers: {
    borderline_score: borderlineScore,
    weak_evidence: shouldTriggerExtraProvider(evidenceMetrics), // ✅ NOUVEAU
    score_divergence: false,
    must_have_uncertain: false,
    vip_candidate: false,
  },
  confidence: calculateConfidence(evidenceMetrics),
  recommended_providers: ['gemini'], // Provider additionnel
  evidence_quality: evidenceMetrics, // ✅ NOUVEAU
};
```

### Exposer dans Context Snapshot

```typescript
export interface ContextSnapshot {
  // ... existing fields
  evidence_quality_sum?: number;           // ✅ NOUVEAU
  evidence_quality_average?: number;       // ✅ NOUVEAU
  weak_evidence_triggered?: boolean;       // ✅ NOUVEAU
}
```

### Tests Requis

1. ✅ Calcul quality score correct (3 tests: strong/medium/weak)
2. ✅ Evidence sum calcul correct (2 tests)
3. ✅ Trigger si average < 1.0 (2 tests)
4. ✅ Trigger si 2+ weak (2 tests)
5. ✅ Integration dans needsMore (2 tests)

**Total**: ~11 tests

---

## 💰 Point #6: Smart Cost Triggering

### Objectif
**Ne pas appeler** systématiquement le multi-provider. Appeler uniquement si:
- Score borderline (60-75)
- Consensus faible
- Preuves faibles (Point #5)
- Soft flags détectés

→ **Économie ~40% des coûts** en évitant les appels inutiles.

### Spécifications

#### 1. Smart Triggers

```typescript
interface SmartTriggers {
  borderline_score: boolean;     // Score entre 60-75
  weak_consensus: boolean;       // Consensus < medium
  weak_evidence: boolean;        // Evidence quality < 1.0
  soft_flags_detected: boolean;  // Prefilter a détecté des flags
  vip_candidate: boolean;        // Candidat VIP (forcer multi)
}

interface SmartTriggerResult {
  should_use_multi_provider: boolean;
  triggers: SmartTriggers;
  reason: string;
  estimated_cost_saving: number; // Si skip, combien économisé
}
```

#### 2. Logique de Déclenchement

```typescript
function evaluateSmartTriggers(
  mainResult: EvaluationResult,
  evidenceMetrics: EvidenceQualityMetrics,
  prefilterFlags: Record<string, number>,
  mode: AnalysisMode
): SmartTriggerResult {
  const score = mainResult.overall_score_0_to_100;

  const triggers: SmartTriggers = {
    borderline_score: score >= 60 && score <= 75,
    weak_consensus: false, // Pas encore de consensus (1er provider)
    weak_evidence: evidenceMetrics.average_evidence_quality < 1.0,
    soft_flags_detected: Object.keys(prefilterFlags).length > 0,
    vip_candidate: false, // TODO: détecter via metadata
  };

  // Mode eco: JAMAIS de multi-provider (sauf VIP)
  if (mode === 'eco' && !triggers.vip_candidate) {
    return {
      should_use_multi_provider: false,
      triggers,
      reason: 'Mode eco: single provider only',
      estimated_cost_saving: 0.026, // ~2 providers évités
    };
  }

  // Mode balanced: Seulement si au moins 1 trigger
  if (mode === 'balanced') {
    const anyTrigger = Object.values(triggers).some(t => t);
    return {
      should_use_multi_provider: anyTrigger,
      triggers,
      reason: anyTrigger
        ? `Triggers: ${Object.entries(triggers).filter(([_, v]) => v).map(([k]) => k).join(', ')}`
        : 'High confidence, no need for multi-provider',
      estimated_cost_saving: anyTrigger ? 0 : 0.026,
    };
  }

  // Mode premium: TOUJOURS multi-provider
  return {
    should_use_multi_provider: true,
    triggers,
    reason: 'Mode premium: always use multi-provider',
    estimated_cost_saving: 0,
  };
}
```

#### 3. Cost Breakdown

```typescript
export interface CostBreakdown {
  total_usd: number;
  by_provider: Record<ProviderName, number>;
  by_stage: {
    extraction: number;
    evaluation: number;
    arbiter?: number;
  };
  smart_cost_saving?: number;     // ✅ NOUVEAU: Économie grâce au smart trigger
  would_have_cost?: number;       // ✅ NOUVEAU: Coût si pas de smart trigger
}
```

### Structure

Pas de nouveau fichier - intégrer directement dans `orchestrator.ts`:

```typescript
// Dans orchestrateAnalysis()

// 1. Analyser avec provider principal
const mainResult = await mainProvider.analyze(cvJson, jobSpec);

// 2. Évaluer evidence quality
const evidenceMetrics = evaluateEvidenceQuality(cvJson, jobSpec, relevanceResults);

// 3. Smart triggers
const smartTrigger = evaluateSmartTriggers(
  mainResult,
  evidenceMetrics,
  prefilterResult?.soft_flags || {},
  options.mode
);

// 4. Décider si appeler providers additionnels
if (smartTrigger.should_use_multi_provider) {
  console.log(`🔄 Smart Trigger: ${smartTrigger.reason}`);
  // Appeler Gemini + Claude
  const additionalResults = await Promise.all([
    geminiProvider.analyze(cvJson, jobSpec),
    claudeProvider.analyze(cvJson, jobSpec),
  ]);
  // Agréger...
} else {
  console.log(`💰 Smart Cost Saving: $${smartTrigger.estimated_cost_saving.toFixed(4)}`);
  console.log(`   Reason: ${smartTrigger.reason}`);
  // Utiliser seulement le résultat principal
}
```

### Exposer dans Context Snapshot

```typescript
export interface ContextSnapshot {
  // ... existing fields
  smart_triggers_used?: SmartTriggers;           // ✅ NOUVEAU
  smart_cost_saving_usd?: number;                // ✅ NOUVEAU
  multi_provider_skipped?: boolean;              // ✅ NOUVEAU
}
```

### Tests Requis

1. ✅ Mode eco: jamais multi (2 tests)
2. ✅ Mode balanced: triggers correct (4 tests)
3. ✅ Mode premium: toujours multi (1 test)
4. ✅ Borderline trigger (2 tests)
5. ✅ Weak evidence trigger (2 tests)
6. ✅ Cost saving calculé (2 tests)

**Total**: ~13 tests

---

## 🎯 Plan d'Implémentation

### Ordre Recommandé

1. **Point #3: Retry + Circuit Breaker** (4h)
   - Fondation résilience
   - Utilisé par #5 et #6
   - Tests isolés

2. **Point #5: Evidence Quality Gating** (4h)
   - Utilisé par #6
   - Tests isolés

3. **Point #6: Smart Cost Triggering** (4h)
   - Combine #3 et #5
   - Tests d'intégration

### Étapes par Point

#### Point #3 (4h)
1. Créer `lib/mcp/resilience/retry.ts` (1h)
2. Créer `lib/mcp/resilience/circuit-breaker.ts` (1.5h)
3. Créer `lib/mcp/resilience/timeout.ts` (0.5h)
4. Écrire tests (12 tests) (1h)

#### Point #5 (4h)
1. Créer `lib/cv-analysis/evidence/quality-evaluator.ts` (2h)
2. Intégrer dans orchestrator (1h)
3. Écrire tests (11 tests) (1h)

#### Point #6 (4h)
1. Implémenter smart triggers dans orchestrator (2h)
2. Ajouter cost breakdown (1h)
3. Écrire tests (13 tests) (1h)

---

## 📊 Métriques de Succès

### Point #3
- ✅ 0 erreurs transitoires non-récupérées
- ✅ Circuit breaker protège contre cascades
- ✅ Timeout respecté à 100%

### Point #5
- ✅ Evidence quality calculé pour chaque analyse
- ✅ Trigger si quality < threshold
- ✅ Exposé dans context snapshot

### Point #6
- ✅ ~40% économie coûts en mode balanced
- ✅ Mode eco: 0 multi-provider (sauf VIP)
- ✅ Mode premium: 100% multi-provider
- ✅ Smart triggers loggés

---

## 🧪 Tests Totaux Phase 2

| Point | Tests | Effort |
|-------|-------|--------|
| #3 Retry/Circuit Breaker | 12 | 1h |
| #5 Evidence Quality | 11 | 1h |
| #6 Smart Cost | 13 | 1h |
| **TOTAL** | **36 tests** | **3h** |

**Total avec implémentation**: 12h (4h × 3 points)

---

## 📝 Questions pour Validation

1. **Ordre d'implémentation**: OK pour faire #3 → #5 → #6 ?
2. **Retry config**: 2 max retries OK, ou préférer 3 ?
3. **Circuit breaker thresholds**: 3 failures → open OK ?
4. **Evidence quality thresholds**: Average < 1.0 trigger OK ?
5. **Smart cost mode balanced**: Trigger seulement si 1+ flag OK ?

---

**Prêt à démarrer ? Je peux commencer par le Point #3 (Retry + Circuit Breaker). Dis-moi "go" pour lancer !** 🚀
