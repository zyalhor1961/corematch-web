# Exemple d'Intégration MCP dans l'Orchestrateur

## 📋 Objectif

Montrer comment intégrer les modules MCP (cache, PII masking, context snapshot) dans l'orchestrateur existant.

---

## 1. Ajouter Cache dans `orchestrateAnalysis()`

### Modifications dans `lib/cv-analysis/orchestrator.ts`:

```typescript
import { generateCacheKey, getCacheStore, hashJobSpec } from '@/lib/mcp';
import { ContextSnapshotBuilder } from '@/lib/mcp/types/context-snapshot';
import type { ContextSnapshot } from '@/lib/mcp/types/context-snapshot';

// Étendre AggregatedResult avec context_snapshot
export interface AggregatedResult {
  final_decision: EvaluationResult;
  providers_raw: Record<ProviderName, EvaluationResult | null>;
  consensus: ConsensusMetrics;
  arbiter?: ArbiterOutput;
  debug: { ... };
  performance: { ... };
  cost: { ... };

  // ✅ AJOUT: Context snapshot pour traçabilité
  context_snapshot: ContextSnapshot;
}

export async function orchestrateAnalysis(
  cvText: string,
  jobSpec: JobSpec,
  options: OrchestrationOptions & {
    projectId: string;  // ✅ AJOUT: Requis pour cache key
  }
): Promise<AggregatedResult> {
  const startTime = Date.now();

  // =========================================================================
  // 0. Initialiser Context Snapshot Builder
  // =========================================================================

  const contextBuilder = new ContextSnapshotBuilder();
  contextBuilder
    .setEngine('corematch-v2')
    .setJobContext(
      options.projectId,
      jobSpec.title,
      hashJobSpec(jobSpec)
    )
    .setMode(options.mode, options.enablePrefilter !== false, options.enablePacking !== false);

  // =========================================================================
  // 1. Extraction du CV (inchangé)
  // =========================================================================

  initValidators();
  const provider = createOpenAIProvider();
  const cvJson = await provider.extract!(cvText);

  // =========================================================================
  // 2. Vérifier Cache
  // =========================================================================

  const cache = getCacheStore();
  const cacheKey = generateCacheKey({
    cvJson,
    projectId: options.projectId,
    jobSpec,
    mode: options.mode,
  });

  console.log(`📦 Cache key: ${cacheKey}`);

  // Check cache
  const cachedResult = await cache.get(cacheKey);
  if (cachedResult) {
    console.log('✅ Cache HIT - Returning cached result');
    return cachedResult;
  }

  console.log('❌ Cache MISS - Proceeding with analysis');

  // =========================================================================
  // 3. Analyse (reste du code existant inchangé)
  // =========================================================================

  // ... prefilter, packing, analysis, aggregation ...

  // =========================================================================
  // 4. Construire Context Snapshot
  // =========================================================================

  const totalTime = Date.now() - startTime;

  // Ajouter détails providers
  contextBuilder.addProviderCall({
    name: 'openai',
    model: 'gpt-4o',
    called_at: new Date().toISOString(),
    duration_ms: evaluationTime,
    cost_usd: mainResult.cost_usd || 0,
    status: 'success',
  });

  if (providersUsed.includes('gemini')) {
    contextBuilder.addProviderCall({
      name: 'gemini',
      model: 'gemini-2.0-flash-exp',
      called_at: new Date().toISOString(),
      duration_ms: 5000,
      cost_usd: 0.015,
      status: 'success',
    });
  }

  // Consensus
  contextBuilder.setConsensus(
    consensus.level,
    arbiter !== undefined,
    arbiter ? 'Consensus faible/modéré' : undefined
  );

  // Cost & Duration
  contextBuilder
    .setCost(totalCost)
    .setDuration(totalTime, extractionTime, evaluationTime);

  // Compliance (pas de masking pour analyse interne)
  contextBuilder.setCompliance('none', false);

  // Disagreements
  contextBuilder.setDisagreements(disagreements);

  const contextSnapshot = contextBuilder.complete();

  // =========================================================================
  // 5. Construire Résultat Final avec Context Snapshot
  // =========================================================================

  const finalResult: AggregatedResult = {
    final_decision: finalDecision,
    providers_raw: providersRaw as any,
    consensus,
    arbiter,
    debug: { ... },
    performance: { ... },
    cost: { ... },

    // ✅ AJOUT
    context_snapshot: contextSnapshot,
  };

  // =========================================================================
  // 6. Stocker dans Cache
  // =========================================================================

  await cache.set(cacheKey, finalResult, 3600); // 1h TTL
  console.log('✅ Result cached');

  return finalResult;
}
```

---

## 2. Ajouter PII Masking pour Analyse MCP

### Nouvelle fonction: `orchestrateAnalysisMCP()`

```typescript
import { maskPII, validateAnalysisRequest } from '@/lib/mcp';

/**
 * Orchestrer une analyse via MCP (avec PII masking et consent check)
 */
export async function orchestrateAnalysisMCP(
  candidateId: string,
  projectId: string,
  jobSpec: JobSpec,
  options: OrchestrationOptions
): Promise<AggregatedResult> {
  const startTime = Date.now();

  // =========================================================================
  // 1. Validation RGPD
  // =========================================================================

  const { consent_granted, pii_masking_level } = await validateAnalysisRequest({
    candidateId,
    projectId,
    requireConsent: true, // ⚠️ Obligatoire pour MCP
  });

  console.log(`🔒 RGPD: Consent=${consent_granted}, Masking=${pii_masking_level}`);

  // =========================================================================
  // 2. Récupérer CV et appliquer PII Masking
  // =========================================================================

  const cvJson = await fetchCandidateCV(candidateId); // TODO: Implémenter

  const { masked: maskedCV, stats: maskingStats } = maskPII(cvJson, pii_masking_level);

  console.log(`🎭 PII Masking: ${maskingStats.masked_count} fields masked`);
  console.log(`   Fields: ${maskingStats.fields_masked.join(', ')}`);

  // =========================================================================
  // 3. Analyser avec CV masqué
  // =========================================================================

  const result = await orchestrateAnalysis(
    JSON.stringify(maskedCV), // ⚠️ CV masqué
    jobSpec,
    {
      ...options,
      projectId,
    }
  );

  // =========================================================================
  // 4. Mettre à jour Context Snapshot avec info compliance
  // =========================================================================

  result.context_snapshot = {
    ...result.context_snapshot,
    pii_masking_level,
    consent_mcp_checked: true,
    consent_mcp_granted: consent_granted,
  };

  // =========================================================================
  // 5. Audit Log
  // =========================================================================

  await logMCPAudit({
    session_id: result.context_snapshot.sessionId,
    request_id: result.context_snapshot.requestId,
    user_id: 'user-id-here', // TODO: Get from auth
    tool_name: 'analyze_cv',
    candidate_id: candidateId,
    project_id: projectId,
    pii_masking_level,
    consent_mcp_checked: true,
    consent_mcp_granted,
    status: 'success',
    duration_ms: result.performance.total_execution_time_ms,
    cost_usd: result.cost.total_usd,
  });

  return result;
}

/**
 * Helper: Log audit MCP
 */
async function logMCPAudit(params: {
  session_id: string;
  request_id: string;
  user_id: string;
  tool_name: string;
  candidate_id: string;
  project_id: string;
  pii_masking_level: PIIMaskingLevel;
  consent_mcp_checked: boolean;
  consent_mcp_granted: boolean;
  status: 'success' | 'failed';
  duration_ms: number;
  cost_usd: number;
}): Promise<void> {
  // TODO: Implémenter avec Supabase
  await supabaseAdmin.from('mcp_audit_logs').insert({
    session_id: params.session_id,
    request_id: params.request_id,
    user_id: params.user_id,
    tool_name: params.tool_name,
    candidate_id: params.candidate_id,
    project_id: params.project_id,
    pii_masking_level: params.pii_masking_level,
    consent_mcp_checked: params.consent_mcp_checked,
    consent_mcp_granted: params.consent_mcp_granted,
    status: params.status,
    duration_ms: params.duration_ms,
    cost_usd: params.cost_usd,
    created_at: new Date().toISOString(),
  });
}
```

---

## 3. Endpoint API pour Analyse MCP

### Nouveau fichier: `app/api/cv/analyze-mcp/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { orchestrateAnalysisMCP } from '@/lib/cv-analysis/orchestrator';
import { verifyAuth } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    // Auth
    const { user, error: authError } = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse body
    const body = await request.json();
    const { candidateId, projectId, mode = 'balanced' } = body;

    if (!candidateId || !projectId) {
      return NextResponse.json(
        { error: 'candidateId and projectId are required' },
        { status: 400 }
      );
    }

    // Fetch JobSpec
    const jobSpec = await fetchJobSpec(projectId); // TODO: Implémenter

    // Analyze avec MCP (PII masking + consent)
    const result = await orchestrateAnalysisMCP(
      candidateId,
      projectId,
      jobSpec,
      { mode, enablePrefilter: true, enablePacking: true }
    );

    // Return avec context snapshot
    return NextResponse.json({
      success: true,
      evaluation: result.final_decision,
      consensus: result.consensus,
      context: result.context_snapshot, // ✅ Traçabilité
      performance: result.performance,
      cost: result.cost,
    });

  } catch (error: any) {
    console.error('[API /analyze-mcp] Error:', error);

    // RGPD consent error
    if (error.message.includes('ERROR_CONSENT_REQUIRED')) {
      return NextResponse.json(
        {
          error: 'CONSENT_REQUIRED',
          message: 'Candidate has not granted MCP consent',
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
```

---

## 4. UI - Afficher Context Snapshot

### Composant React: `components/EvaluationResultCard.tsx`

```typescript
import { ContextSnapshot } from '@/lib/mcp/types/context-snapshot';
import { Badge } from '@/components/ui/badge';

interface Props {
  evaluation: EvaluationResult;
  contextSnapshot: ContextSnapshot;
}

export function EvaluationResultCard({ evaluation, contextSnapshot }: Props) {
  return (
    <div className="border rounded-lg p-4">
      {/* Score */}
      <div className="text-2xl font-bold">
        {evaluation.overall_score_0_to_100}/100
      </div>

      {/* Recommendation */}
      <Badge variant={
        evaluation.recommendation === 'SHORTLIST' ? 'success' :
        evaluation.recommendation === 'CONSIDER' ? 'warning' : 'destructive'
      }>
        {evaluation.recommendation}
      </Badge>

      {/* Context Snapshot */}
      <div className="mt-4 border-t pt-4">
        <h4 className="text-sm font-semibold mb-2">Analysis Context</h4>

        <div className="flex flex-wrap gap-2 text-xs">
          {/* Engine */}
          <Badge variant="outline">
            {contextSnapshot.engine} v{contextSnapshot.engine_version}
          </Badge>

          {/* Mode */}
          <Badge variant="outline">
            {contextSnapshot.mode}
          </Badge>

          {/* Consensus */}
          <Badge variant={
            contextSnapshot.consensus_level === 'strong' ? 'success' :
            contextSnapshot.consensus_level === 'medium' ? 'warning' : 'destructive'
          }>
            {contextSnapshot.consensus_level} consensus
          </Badge>

          {/* Providers */}
          <Badge variant="outline">
            {contextSnapshot.providers_called.length} providers
          </Badge>

          {/* Cost */}
          <Badge variant="outline">
            ${contextSnapshot.cost_total_usd.toFixed(3)}
          </Badge>

          {/* Duration */}
          <Badge variant="outline">
            {contextSnapshot.duration_total_ms}ms
          </Badge>

          {/* PII Masking (si applicable) */}
          {contextSnapshot.pii_masking_level !== 'none' && (
            <Badge variant="secondary">
              🔒 PII {contextSnapshot.pii_masking_level}
            </Badge>
          )}
        </div>

        {/* Request ID (pour debug) */}
        <div className="mt-2 text-[10px] text-gray-500">
          Request: {contextSnapshot.requestId.substring(0, 8)}...
        </div>
      </div>
    </div>
  );
}
```

---

## 5. UI - Checkbox Consent MCP

### Composant: `components/CandidateUploadForm.tsx`

```typescript
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export function CandidateUploadForm() {
  const [consentMCP, setConsentMCP] = useState(false);

  const handleUpload = async () => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('consent_mcp', consentMCP.toString());

    await fetch(`/api/cv/projects/${projectId}/upload`, {
      method: 'POST',
      body: formData,
    });
  };

  return (
    <form>
      {/* File input */}
      <input type="file" onChange={...} />

      {/* Consent checkbox */}
      <div className="flex items-center space-x-2 mt-4">
        <Checkbox
          id="consent-mcp"
          checked={consentMCP}
          onCheckedChange={setConsentMCP}
        />
        <Label htmlFor="consent-mcp" className="text-sm">
          J'autorise l'analyse de ce CV via MCP (Model Context Protocol).
          Les données personnelles seront masquées selon la politique de confidentialité.
          <a href="/privacy" className="underline ml-1">En savoir plus</a>
        </Label>
      </div>

      <button onClick={handleUpload} disabled={!consentMCP}>
        Upload CV
      </button>
    </form>
  );
}
```

---

## 6. Monitoring & Dashboard

### Supabase Query - Stats MCP par projet:

```sql
SELECT * FROM get_mcp_stats_by_project('project-uuid-here');
```

Retourne:
```json
{
  "total_analyses": 150,
  "with_consent": 145,
  "without_consent": 5,
  "total_cost_usd": 37.50,
  "avg_duration_ms": 8500
}
```

### Dashboard React:

```typescript
export function MCPStatsWidget({ projectId }: { projectId: string }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/mcp-stats`)
      .then(res => res.json())
      .then(setStats);
  }, [projectId]);

  if (!stats) return <Spinner />;

  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard title="Analyses" value={stats.total_analyses} />
      <StatCard title="Consent Rate" value={`${(stats.with_consent / stats.total_analyses * 100).toFixed(0)}%`} />
      <StatCard title="Total Cost" value={`$${stats.total_cost_usd.toFixed(2)}`} />
      <StatCard title="Avg Duration" value={`${(stats.avg_duration_ms / 1000).toFixed(1)}s`} />
    </div>
  );
}
```

---

## ✅ Checklist d'Intégration Complète

- [ ] Modifier `orchestrator.ts` pour ajouter cache
- [ ] Créer `orchestrateAnalysisMCP()` avec PII masking
- [ ] Appliquer migration Supabase `010_mcp_rgpd_fields.sql`
- [ ] Créer endpoint `/api/cv/analyze-mcp`
- [ ] Créer composant `EvaluationResultCard` avec context snapshot
- [ ] Créer composant `CandidateUploadForm` avec consent checkbox
- [ ] Créer dashboard stats MCP
- [ ] Tests E2E complets
- [ ] Documentation utilisateur

---

**Temps estimé d'intégration**: 2-3 jours
