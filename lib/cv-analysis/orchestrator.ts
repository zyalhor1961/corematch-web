/**
 * Orchestrator : Chef d'orchestre de l'analyse CV
 *
 * Gère:
 * - Sélection du mode (Éco/Équilibré/Premium)
 * - Pré-filtre Stage 0
 * - Compression tokens (packer)
 * - Décision multi-provider (needsMore)
 * - Orchestration de l'analyse
 * - Agrégation des résultats
 */

import type {
  CV_JSON,
  JobSpec,
  AnalysisMode,
  AggregatedResult,
  NeedsMoreAnalysis,
  UncertaintyTriggers,
  EvaluationResult,
  ProviderResult,
  ConsensusMetrics,
  ArbiterOutput,
  ModelDisagreement,
} from './types';

import { initValidators, validateCVData } from './validators';
import { prefilterCV, interpretSoftFlags } from './prefilter/stage0-prefilter';
import { packContext, buildCompactedCV, estimateTokenSavings } from './packer/context-packer';
import { evaluateAllExperiences } from './rules/relevance-rules';
import { evaluateMustHaveRules } from './rules/must-have-evaluator';
import { matchSkills } from './rules/skills-map';
import { createOpenAIProvider } from './providers/openai-provider';
import { createGeminiProvider } from './providers/gemini-provider';
import { createClaudeProvider } from './providers/claude-provider';
import { aggregateProviderResults } from './aggregator/multi-provider-aggregator';
import { UNCERTAINTY_THRESHOLDS, getProvidersForMode } from './config';

// ✅ NOUVEAU: Imports MCP pour cache et context snapshot
import { generateCacheKey, getCacheStore, hashJobSpec, hashCVText, ContextSnapshotBuilder } from '@/lib/mcp';
import type { EngineType } from '@/lib/mcp/types/context-snapshot';

/**
 * Options d'orchestration
 */
export interface OrchestrationOptions {
  mode: AnalysisMode;
  projectId: string; // ✅ NOUVEAU: ID du projet (requis pour cache key)
  orgId?: string; // ✅ NOUVEAU: ID de l'organisation (pour instructions AI personnalisées)
  enablePrefilter?: boolean; // Défaut: true en balanced/premium
  enablePacking?: boolean; // Défaut: true
  forceSingleProvider?: boolean; // Forcer mode single provider (pour tests)
  analysisDate?: string; // Date d'analyse (défaut: aujourd'hui)
  engine?: EngineType; // ✅ NOUVEAU: Engine utilisé (défaut: 'corematch-v2')
  candidateId?: string; // ✅ NOUVEAU: ID du candidat (pour consent/masking DB)
}

/**
 * Orchestrer une analyse CV complète
 */
export async function orchestrateAnalysis(
  cvText: string,
  jobSpec: JobSpec,
  options: OrchestrationOptions
): Promise<AggregatedResult> {
  const startTime = Date.now();

  console.log('\n════════════════════════════════════════════════');
  console.log(`🎬 ORCHESTRATOR: Starting analysis in ${options.mode.toUpperCase()} mode`);
  console.log(`   Job: ${jobSpec.title}`);
  console.log('════════════════════════════════════════════════\n');

  // =========================================================================
  // 1. Initialiser les validators
  // =========================================================================

  initValidators();

  // =========================================================================
  // 2. ✅ NOUVEAU: Hasher le texte brut et vérifier Cache AVANT extraction
  // =========================================================================

  // Hasher le texte brut pour clé de cache stable (déterministe)
  const cvTextHash = hashCVText(cvText);

  const cache = getCacheStore();
  const cacheKey = generateCacheKey({
    cvTextHash,
    projectId: options.projectId,
    jobSpec,
    mode: options.mode,
  });

  console.log(`📦 Cache key: ${cacheKey.substring(0, 60)}...`);

  const cachedResult = await cache.get(cacheKey);
  if (cachedResult) {
    const cacheAge = Date.now() - new Date(cachedResult.context_snapshot.analysis_started_at).getTime();
    console.log(`✅ CACHE HIT! (age: ${Math.round(cacheAge / 1000)}s)`);
    console.log(`   Returning cached result from ${cachedResult.context_snapshot.engine}`);
    console.log(`   Original cost: $${cachedResult.cost.total_usd.toFixed(4)}\n`);
    return cachedResult;
  }

  console.log(`❌ Cache MISS - Proceeding with full analysis\n`);

  // =========================================================================
  // 3. Extraction du CV
  // =========================================================================

  console.log('📄 Step 2: CV Extraction');
  const extractionStart = Date.now();

  const provider = createOpenAIProvider();
  const cvJson = await provider.extract!(cvText);

  // Valider le CV extrait
  const cvValidation = validateCVData(cvJson);
  if (!cvValidation.valid) {
    throw new Error(`CV validation failed: ${cvValidation.errorMessage}`);
  }

  const extractionTime = Date.now() - extractionStart;
  console.log(`✅ CV extracted and validated in ${extractionTime}ms\n`);

  // =========================================================================
  // 4. Pré-filtre Stage 0 (optionnel)
  // =========================================================================

  let prefilterTime = 0;
  let earlyExit = false;

  if (options.enablePrefilter !== false && (options.mode === 'balanced' || options.mode === 'premium')) {
    console.log('🔍 Step 2: Stage 0 Prefilter');
    const prefilterStart = Date.now();

    const prefilterResult = await prefilterCV(cvJson, jobSpec);
    prefilterTime = Date.now() - prefilterStart;

    console.log(`   Confidence: ${(prefilterResult.confidence * 100).toFixed(0)}%`);
    console.log(`   Soft flags: ${Object.keys(prefilterResult.soft_flags).length}`);

    if (!prefilterResult.pass) {
      console.log(`❌ CV rejected by prefilter`);
      console.log(`   Reasons: ${prefilterResult.reasons.join(', ')}`);
      earlyExit = true;
    }

    console.log(`✅ Prefilter completed in ${prefilterTime}ms\n`);
  }

  // =========================================================================
  // 4. Context Packing (optionnel)
  // =========================================================================

  let packedContext;
  let compactedCV = cvJson;

  if (options.enablePacking !== false) {
    console.log('📦 Step 3: Context Packing');
    const packingStart = Date.now();

    packedContext = await packContext(cvJson, jobSpec);

    if (!packedContext.fallback_to_full) {
      const savings = estimateTokenSavings(packedContext);
      console.log(`   Compression: ${(packedContext.compression_ratio * 100).toFixed(0)}%`);
      console.log(`   Saved tokens: ~${savings.savedTokensEstimate}`);

      compactedCV = buildCompactedCV(cvJson, packedContext) as CV_JSON;
    } else {
      console.log(`   CV too small, using full version`);
    }

    const packingTime = Date.now() - packingStart;
    console.log(`✅ Packing completed in ${packingTime}ms\n`);
  }

  // =========================================================================
  // 5. Analyse avec provider principal
  // =========================================================================

  console.log('🤖 Step 4: Main Provider Analysis');
  const evaluationStart = Date.now();

  const mainResult = await provider.analyze(compactedCV, jobSpec);

  if (!mainResult.result) {
    throw new Error(`Main provider failed: ${mainResult.error}`);
  }

  const evaluationTime = Date.now() - evaluationStart;
  console.log(`✅ Analysis completed in ${evaluationTime}ms\n`);

  // =========================================================================
  // 6. Décider si besoin d'autres providers (needsMore)
  // =========================================================================

  const needsMore = evaluateNeedsMoreProviders(mainResult.result, jobSpec, options);

  console.log('🔄 Step 5: Evaluate Need for Additional Providers');
  console.log(`   Needs more: ${needsMore.needs_more}`);
  console.log(`   Confidence: ${(needsMore.confidence * 100).toFixed(0)}%`);
  console.log(`   Triggers: ${Object.entries(needsMore.triggers).filter(([_, v]) => v).map(([k]) => k).join(', ') || 'none'}\n`);

  // =========================================================================
  // 7. Appeler providers additionnels si nécessaire
  // =========================================================================

  const providersUsed = [mainResult.provider];
  const providersRaw: Record<string, EvaluationResult | null> = {
    [mainResult.provider]: mainResult.result,
  };

  let totalCost = mainResult.cost_usd || 0;

  // Si needsMore et pas forcé en single provider, appeler providers additionnels
  if (needsMore.needs_more && !options.forceSingleProvider) {
    console.log(`🔄 Step 6: Calling Additional Providers`);
    console.log(`   Recommended providers: ${needsMore.recommended_providers.join(', ')}`);

    // Appeler les providers additionnels en parallèle
    const additionalProviders: Array<{ name: string; promise: Promise<ProviderResult> }> = [];

    // Gemini
    if (needsMore.recommended_providers.includes('gemini') || options.mode === 'premium') {
      try {
        const geminiProvider = createGeminiProvider();
        additionalProviders.push({
          name: 'gemini',
          promise: geminiProvider.analyze(compactedCV, jobSpec),
        });
      } catch (error) {
        console.warn(`[Orchestrator] Could not create Gemini provider:`, error);
      }
    }

    // Claude
    if (needsMore.recommended_providers.includes('claude') || options.mode === 'premium') {
      try {
        const claudeProvider = createClaudeProvider();
        additionalProviders.push({
          name: 'claude',
          promise: claudeProvider.analyze(compactedCV, jobSpec),
        });
      } catch (error) {
        console.warn(`[Orchestrator] Could not create Claude provider:`, error);
      }
    }

    // Attendre les résultats
    const additionalResults = await Promise.all(additionalProviders.map((p) => p.promise));

    // Ajouter les résultats valides
    additionalResults.forEach((result, idx) => {
      const providerName = additionalProviders[idx].name as any;

      if (result.result) {
        providersUsed.push(providerName);
        providersRaw[providerName] = result.result;
        totalCost += result.cost_usd || 0;

        console.log(
          `   ✅ ${providerName}: Score ${result.result.overall_score_0_to_100.toFixed(1)}, Cost $${(result.cost_usd || 0).toFixed(4)}`
        );
      } else {
        console.warn(`   ❌ ${providerName} failed: ${result.error}`);
        providersRaw[providerName] = null;
      }
    });

    console.log(`✅ Additional providers completed\n`);
  }

  // =========================================================================
  // 8. Agréger les résultats (si multi-provider)
  // =========================================================================

  let finalDecision: EvaluationResult;
  let consensus: ConsensusMetrics;
  let arbiter: ArbiterOutput | undefined;
  let disagreements: string[] = [];
  let aggregationMethod: 'single_provider' | 'weighted_average' | 'arbiter' = 'single_provider';

  if (providersUsed.length > 1) {
    console.log(`🔄 Step 7: Aggregating Multi-Provider Results`);

    // Agréger avec l'aggregator
    const aggregationResult = aggregateProviderResults(providersRaw as any, {
      useWeights: true,
      minimumProviders: 1,
    });

    finalDecision = aggregationResult.final_decision;
    consensus = aggregationResult.consensus;
    disagreements = aggregationResult.disagreements;
    aggregationMethod = 'weighted_average';

    // Si consensus faible, appeler l'arbitre
    if (consensus.level === 'weak' || (options.mode === 'premium' && consensus.level === 'medium')) {
      console.log(`🤖 Step 8: Calling Arbiter (consensus ${consensus.level})`);

      try {
        // Utiliser OpenAI comme arbitre par défaut
        const arbiterProvider = createOpenAIProvider();
        const arbiterResult = await arbiterProvider.arbitrate!(providersRaw as any, jobSpec);

        arbiter = {
          final_decision: arbiterResult,
          justification: 'Arbitrage réalisé par OpenAI gpt-4o en raison d\'un consensus faible/medium',
          arbitrage_summary: 'Arbiter called due to weak/medium consensus',
          resolved_disagreements: [],
          execution_time_ms: 0, // TODO: Track actual execution time
        };

        finalDecision = arbiterResult;
        aggregationMethod = 'arbiter';
        totalCost += 0.01; // Estimation coût arbitre

        console.log(`✅ Arbiter completed: Final score ${arbiterResult.overall_score_0_to_100.toFixed(1)}/100\n`);
      } catch (error) {
        console.warn(`[Orchestrator] Arbiter failed:`, error);
        // Garder le résultat agrégé
      }
    }
  } else {
    // Single provider
    finalDecision = mainResult.result!;
    consensus = {
      level: 'strong',
      delta_overall_score: 0,
      delta_subscores: {
        experience: 0,
        skills: 0,
        nice_to_have: 0,
      },
      agreement_rate: 1.0,
      disagreements_count: 0,
    };
  }

  // =========================================================================
  // 9. Construire le résultat final
  // =========================================================================

  const totalTime = Date.now() - startTime;

  // Calculer les coûts par provider
  const costsByProvider = {
    openai: providersRaw.openai ? (mainResult.cost_usd || 0) : 0,
    gemini: providersRaw.gemini ? 0.015 : 0, // Estimation
    claude: providersRaw.claude ? 0.018 : 0, // Estimation
  };

  // =========================================================================
  // 8.5. ✅ NOUVEAU: Construire Context Snapshot
  // =========================================================================

  const contextBuilder = new ContextSnapshotBuilder(options.engine);

  // Set job context
  contextBuilder.setJobContext(
    options.projectId,
    jobSpec.title,
    hashJobSpec(jobSpec)
  );

  // Set mode
  contextBuilder.setMode(
    options.mode,
    options.enablePrefilter !== false,
    options.enablePacking !== false
  );

  // Add provider calls
  if (providersRaw.openai) {
    contextBuilder.addProviderCall({
      name: 'openai',
      model: 'gpt-4o',
      called_at: new Date(startTime).toISOString(),
      duration_ms: evaluationTime,
      cost_usd: mainResult.cost_usd || 0,
      status: 'success',
    });
  }

  if (providersRaw.gemini) {
    contextBuilder.addProviderCall({
      name: 'gemini',
      model: 'gemini-2.0-flash-exp',
      called_at: new Date(startTime + evaluationTime).toISOString(),
      duration_ms: 5000, // Estimation
      cost_usd: 0.015,
      status: 'success',
    });
  }

  if (providersRaw.claude) {
    contextBuilder.addProviderCall({
      name: 'claude',
      model: 'claude-sonnet-4-5-20250929',
      called_at: new Date(startTime + evaluationTime).toISOString(),
      duration_ms: 5000, // Estimation
      cost_usd: 0.018,
      status: 'success',
    });
  }

  // Set consensus
  contextBuilder.setConsensus(
    consensus.level,
    arbiter !== undefined,
    arbiter ? `Arbitrage: ${consensus.level} consensus` : undefined
  );

  // Set disagreements
  contextBuilder.setDisagreements(disagreements);

  // Set cost & duration
  contextBuilder.setCost(totalCost);
  contextBuilder.setDuration(totalTime, extractionTime, evaluationTime);

  // Set compliance
  if (options.candidateId) {
    // Si candidateId fourni, vérifier consent et masking depuis DB
    await contextBuilder.setConsentFromDB(options.candidateId);
    await contextBuilder.setMaskingLevelFromDB(options.projectId);
  } else {
    // Sinon, pas de masking (usage interne direct)
    contextBuilder.setCompliance('none', false);
  }

  // Build snapshot
  const contextSnapshot = contextBuilder.complete();

  const finalResult: AggregatedResult = {
    final_decision: finalDecision,
    providers_raw: providersRaw as any,
    consensus,
    arbiter,
    debug: {
      mode: options.mode,
      providers_used: providersUsed as any,
      aggregation_method: aggregationMethod,
      model_disagreements: disagreements as any, // TODO: Convert string[] to ModelDisagreement[]
      early_exit: earlyExit,
      reasons_for_multi_provider: needsMore.needs_more
        ? Object.entries(needsMore.triggers)
            .filter(([_, v]) => v)
            .map(([k]) => k)
        : undefined,
    },
    performance: {
      total_execution_time_ms: totalTime,
      prefilter_time_ms: prefilterTime || undefined,
      extraction_time_ms: extractionTime,
      evaluation_time_ms: evaluationTime,
    },
    cost: {
      total_usd: totalCost,
      by_provider: costsByProvider,
      by_stage: {
        extraction: 0.002, // Estimation pour gpt-4o-mini
        evaluation: totalCost - 0.002,
      },
    },
    // ✅ NOUVEAU: Context snapshot pour traçabilité
    context_snapshot: contextSnapshot,
  };

  console.log('════════════════════════════════════════════════');
  console.log(`✅ ORCHESTRATOR: Analysis completed`);
  console.log(`   Total time: ${totalTime}ms`);
  console.log(`   Total cost: $${finalResult.cost.total_usd.toFixed(4)}`);
  console.log(`   Recommendation: ${finalResult.final_decision.recommendation}`);
  console.log(`   Score: ${finalResult.final_decision.overall_score_0_to_100.toFixed(1)}/100`);
  console.log('════════════════════════════════════════════════\n');

  // =========================================================================
  // 10. ✅ NOUVEAU: Stocker dans Cache
  // =========================================================================

  await cache.set(cacheKey, finalResult, 3600); // TTL: 1 heure
  console.log(`💾 Result cached for 1 hour (key: ${cacheKey.substring(0, 40)}...)\n`);

  return finalResult;
}

/**
 * Évaluer si des providers additionnels sont nécessaires (needsMore)
 */
function evaluateNeedsMoreProviders(
  mainResult: EvaluationResult,
  jobSpec: JobSpec,
  options: OrchestrationOptions
): NeedsMoreAnalysis {
  // En mode Éco, jamais de providers additionnels
  if (options.mode === 'eco') {
    return {
      needs_more: false,
      triggers: {
        borderline_score: false,
        weak_evidence: false,
        score_divergence: false,
        must_have_uncertain: false,
        vip_candidate: false,
      },
      confidence: 1.0,
      recommended_providers: [],
    };
  }

  // Forcer single provider (pour tests)
  if (options.forceSingleProvider) {
    return {
      needs_more: false,
      triggers: {
        borderline_score: false,
        weak_evidence: false,
        score_divergence: false,
        must_have_uncertain: false,
        vip_candidate: false,
      },
      confidence: 1.0,
      recommended_providers: [],
    };
  }

  const triggers: UncertaintyTriggers = {
    borderline_score: false,
    weak_evidence: false,
    score_divergence: false,
    must_have_uncertain: false,
    vip_candidate: false,
  };

  // =========================================================================
  // Trigger 1: Score borderline
  // =========================================================================

  const thresholds = jobSpec.thresholds || { consider_min: 60, shortlist_min: 75, years_full_score: 3 };
  const score = mainResult.overall_score_0_to_100;

  if (score >= thresholds.consider_min && score < thresholds.shortlist_min) {
    triggers.borderline_score = true;
  }

  // =========================================================================
  // Trigger 2: Preuves faibles
  // =========================================================================

  const evidenceCount = [
    ...mainResult.strengths.flatMap((s) => s.evidence),
    ...mainResult.relevance_summary.by_experience.flatMap((e) => e.evidence),
  ].length;

  if (evidenceCount < UNCERTAINTY_THRESHOLDS.min_evidence_count) {
    triggers.weak_evidence = true;
  }

  // =========================================================================
  // Trigger 3: Écart entre sous-scores
  // =========================================================================

  const { subscores } = mainResult;
  const scoreDiff = Math.max(
    Math.abs(subscores.experience_years_relevant * 100 - subscores.skills_match_0_to_100),
    Math.abs(subscores.skills_match_0_to_100 - subscores.nice_to_have_0_to_100)
  );

  if (scoreDiff > UNCERTAINTY_THRESHOLDS.subscore_divergence_threshold) {
    triggers.score_divergence = true;
  }

  // =========================================================================
  // Trigger 4: Must-have incertain
  // =========================================================================

  for (const fail of mainResult.fails) {
    if (fail.evidence.length < UNCERTAINTY_THRESHOLDS.must_have_weak_evidence_threshold) {
      triggers.must_have_uncertain = true;
      break;
    }
  }

  // =========================================================================
  // Calculer la confiance
  // =========================================================================

  const triggersCount = Object.values(triggers).filter((v) => v).length;
  const confidence = Math.max(0.3, 1 - triggersCount * 0.2);

  const needsMore = triggersCount >= 2 || (options.mode === 'premium' && triggersCount >= 1);

  return {
    needs_more: needsMore,
    triggers,
    confidence,
    recommended_providers: needsMore ? ['gemini', 'claude'] : [],
  };
}
