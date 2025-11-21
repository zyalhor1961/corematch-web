/**
 * CV Analysis Nodes
 * Specialized nodes for CV analysis workflows
 */

import type { NodeFunction } from '../../core/types';
import type {
  CV_JSON,
  JobSpec,
  AnalysisMode,
  EvaluationResult,
  NeedsMoreAnalysis,
  ConsensusMetrics,
  ArbiterOutput,
} from '@/lib/cv-analysis/types';
import { initValidators, validateCVData } from '@/lib/cv-analysis/validators';
import { prefilterCV } from '@/lib/cv-analysis/prefilter/stage0-prefilter';
import { packContext, buildCompactedCV, estimateTokenSavings } from '@/lib/cv-analysis/packer/context-packer';
import { createOpenAIProvider } from '@/lib/cv-analysis/providers/openai-provider';
import { createGeminiProvider } from '@/lib/cv-analysis/providers/gemini-provider';
import { createClaudeProvider } from '@/lib/cv-analysis/providers/claude-provider';
import { aggregateProviderResults } from '@/lib/cv-analysis/aggregator/multi-provider-aggregator';
import { UNCERTAINTY_THRESHOLDS } from '@/lib/cv-analysis/config';
import { generateCacheKey, getCacheStore, hashCVText, hashJobSpec, ContextSnapshotBuilder } from '@/lib/mcp';
import type { EngineType } from '@/lib/mcp/types/context-snapshot';

/**
 * Initialize validators node
 */
export const initializeValidators: NodeFunction = async (state, input) => {
  try {
    initValidators();
    return {
      success: true,
      stateUpdates: {
        validatorsInitialized: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Validator initialization failed',
    };
  }
};

/**
 * Check cache node
 */
export const checkCache: NodeFunction<
  { cvText: string; jobSpec: JobSpec; projectId: string; mode: AnalysisMode },
  { cached: boolean; result?: any }
> = async (state, input) => {
  try {
    // Get data from state
    const cvText = state.data.cvText as string;
    const jobSpec = state.data.jobSpec as JobSpec;
    const projectId = state.data.projectId as string;
    const mode = state.data.mode as AnalysisMode;

    const cvTextHash = hashCVText(cvText);
    const cache = getCacheStore();
    const cacheKey = generateCacheKey({
      cvTextHash,
      projectId,
      jobSpec,
      mode,
    });

    console.log(`📦 Cache key: ${cacheKey.substring(0, 60)}...`);

    const cachedResult = await cache.get(cacheKey);

    if (cachedResult) {
      const cacheAge = Date.now() - new Date(cachedResult.context_snapshot.analysis_started_at).getTime();
      console.log(`✅ CACHE HIT! (age: ${Math.round(cacheAge / 1000)}s)`);
      return {
        success: true,
        data: { cached: true, result: cachedResult },
        stateUpdates: {
          cacheHit: true,
          cachedResult,
          cacheKey,
        },
      };
    }

    console.log(`❌ Cache MISS - Proceeding with analysis\n`);
    return {
      success: true,
      data: { cached: false },
      stateUpdates: {
        cacheHit: false,
        cacheKey,
        cvTextHash,
      },
    };
  } catch (error) {
    // Non-blocking - continue without cache
    console.warn('[checkCache] Cache check failed:', error);
    return {
      success: true,
      data: { cached: false },
      stateUpdates: {
        cacheHit: false,
        cacheError: error instanceof Error ? error.message : 'Cache check failed',
      },
    };
  }
};

/**
 * Extract CV node
 */
export const extractCV: NodeFunction<
  { cvText: string },
  { cvJson: CV_JSON; extractionTime: number }
> = async (state, input) => {
  const startTime = Date.now();

  try {
    console.log('📄 Extracting CV...');

    // Get cvText from state (passed during graph initialization)
    const cvText = state.data.cvText as string;

    if (!cvText) {
      throw new Error('CV text not found in state');
    }

    const provider = createOpenAIProvider();
    const cvJson = await provider.extract!(cvText);

    const extractionTime = Date.now() - startTime;
    console.log(`✅ CV extracted in ${extractionTime}ms\n`);

    return {
      success: true,
      data: { cvJson, extractionTime },
      stateUpdates: {
        cvJson,
        extractionTime,
      },
      metadataUpdates: {
        extractionTime,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'CV extraction failed',
    };
  }
};

/**
 * Validate CV node
 */
export const validateCV: NodeFunction<{ cvJson: CV_JSON }, { valid: boolean }> = async (state, input) => {
  try {
    console.log('✅ Validating CV data...');

    // Get cvJson from state (set by previous extract node)
    const cvJson = state.data.cvJson as CV_JSON;

    if (!cvJson) {
      throw new Error('CV JSON not found in state');
    }

    const validation = validateCVData(cvJson);

    if (!validation.valid) {
      const errorMessage = `CV validation failed: ${validation.errorMessage}`;
      console.error(`❌ ${errorMessage}\n`);
      return {
        success: false,
        error: errorMessage,
      };
    }

    console.log('✅ CV validation passed\n');
    return {
      success: true,
      data: { valid: true },
      stateUpdates: {
        cvValid: true,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'CV validation failed';
    console.error(`❌ CV validation exception: ${errorMessage}\n`);
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Prefilter CV node (Stage 0)
 */
export const prefilterCVNode: NodeFunction<
  { cvJson: CV_JSON; jobSpec: JobSpec },
  { pass: boolean; confidence: number; prefilterTime: number }
> = async (state, input) => {
  const startTime = Date.now();

  try {
    console.log('🔍 Running Stage 0 Prefilter...');

    // Get data from state
    const cvJson = state.data.cvJson as CV_JSON;
    const jobSpec = state.data.jobSpec as JobSpec;

    if (!cvJson || !jobSpec) {
      throw new Error('CV JSON or JobSpec not found in state');
    }

    const result = await prefilterCV(cvJson, jobSpec);
    const prefilterTime = Date.now() - startTime;

    console.log(`   Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    console.log(`   Soft flags: ${Object.keys(result.soft_flags).length}`);

    if (!result.pass) {
      console.log(`❌ CV rejected by prefilter`);
      console.log(`   Reasons: ${result.reasons.join(', ')}`);

      // Create rejection decision for early exit
      const rejectionDecision: EvaluationResult = {
        recommendation: 'REJECT',
        overall_score_0_to_100: 0,
        subscores: {
          experience_years_relevant: 0,
          skills_match_0_to_100: 0,
          nice_to_have_0_to_100: 0,
        },
        relevance_summary: {
          months_direct: 0,
          months_adjacent: 0,
          by_experience: [],
        },
        strengths: [],
        improvements: [],
        fails: result.reasons.map((reason, idx) => ({
          must_have_id: `PREFILTER_${idx}`,
          reason,
          evidence: [],
        })),
        timestamp: new Date().toISOString(),
      };

      console.log(`✅ Prefilter completed in ${prefilterTime}ms\n`);

      return {
        success: true,
        data: { pass: result.pass, confidence: result.confidence, prefilterTime },
        stateUpdates: {
          prefilterPass: result.pass,
          prefilterConfidence: result.confidence,
          prefilterReasons: result.reasons,
          prefilterTime,
          earlyExit: true,
          finalDecision: rejectionDecision,
          providersUsed: [],
          providersRaw: {},
        },
        metadataUpdates: {
          prefilterTime,
        },
      };
    }

    console.log(`✅ Prefilter completed in ${prefilterTime}ms\n`);

    return {
      success: true,
      data: { pass: result.pass, confidence: result.confidence, prefilterTime },
      stateUpdates: {
        prefilterPass: result.pass,
        prefilterConfidence: result.confidence,
        prefilterReasons: result.reasons,
        prefilterTime,
        earlyExit: !result.pass,
      },
      metadataUpdates: {
        prefilterTime,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Prefilter failed';
    console.error(`❌ Prefilter exception: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Pack context node (token compression)
 */
export const packContextNode: NodeFunction<
  { cvJson: CV_JSON; jobSpec: JobSpec },
  { compactedCV: CV_JSON; compressionRatio: number }
> = async (state, input) => {
  const startTime = Date.now();

  try {
    console.log('📦 Packing context...');

    // Get data from state
    const cvJson = state.data.cvJson as CV_JSON;
    const jobSpec = state.data.jobSpec as JobSpec;

    if (!cvJson || !jobSpec) {
      throw new Error('CV JSON or JobSpec not found in state');
    }

    const packedContext = await packContext(cvJson, jobSpec);
    let compactedCV = cvJson;

    if (!packedContext.fallback_to_full) {
      const savings = estimateTokenSavings(packedContext);
      console.log(`   Compression: ${(packedContext.compression_ratio * 100).toFixed(0)}%`);
      console.log(`   Saved tokens: ~${savings.savedTokensEstimate}`);

      compactedCV = buildCompactedCV(cvJson, packedContext) as CV_JSON;
    } else {
      console.log(`   CV too small, using full version`);
    }

    const packingTime = Date.now() - startTime;
    console.log(`✅ Packing completed in ${packingTime}ms\n`);

    return {
      success: true,
      data: { compactedCV, compressionRatio: packedContext.compression_ratio },
      stateUpdates: {
        compactedCV,
        packingTime,
      },
      metadataUpdates: {
        packingTime,
      },
    };
  } catch (error) {
    // Non-blocking - fallback to full CV
    console.warn('[packContext] Packing failed, using full CV:', error);
    const cvJson = state.data.cvJson as CV_JSON;
    return {
      success: true,
      data: { compactedCV: cvJson, compressionRatio: 1.0 },
      stateUpdates: {
        compactedCV: cvJson,
        packingError: error instanceof Error ? error.message : 'Packing failed',
      },
    };
  }
};

/**
 * Analyze with main provider node
 */
export const analyzeMainProvider: NodeFunction<
  { compactedCV: CV_JSON; jobSpec: JobSpec },
  { result: EvaluationResult; cost: number; evaluationTime: number }
> = async (state, input) => {
  const startTime = Date.now();

  try {
    console.log('🤖 Analyzing with main provider (OpenAI)...');

    // Get data from state
    const compactedCV = state.data.compactedCV as CV_JSON;
    const jobSpec = state.data.jobSpec as JobSpec;
    const orgAISettings = state.data.orgAISettings as import('@/lib/types').OrgAISettings | null | undefined;

    if (!compactedCV || !jobSpec) {
      throw new Error('Compacted CV or JobSpec not found in state');
    }

    const provider = createOpenAIProvider();
    // Pass org AI settings for custom instruction injection
    const providerResult = await provider.analyze(compactedCV, jobSpec, orgAISettings);

    if (!providerResult.result) {
      throw new Error(`Main provider failed: ${providerResult.error}`);
    }

    const evaluationTime = Date.now() - startTime;
    console.log(`✅ Analysis completed in ${evaluationTime}ms\n`);

    return {
      success: true,
      data: { result: providerResult.result, cost: providerResult.cost_usd || 0, evaluationTime },
      stateUpdates: {
        mainResult: providerResult.result,
        mainCost: providerResult.cost_usd || 0,
        evaluationTime,
        providersRaw: {
          openai: providerResult.result,
        },
        providersUsed: ['openai'],
      },
      metadataUpdates: {
        evaluationTime,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Main provider analysis failed',
    };
  }
};

/**
 * Evaluate if additional providers are needed (needsMore logic)
 */
export const evaluateNeedsMore: NodeFunction<
  { mainResult: EvaluationResult; jobSpec: JobSpec; mode: AnalysisMode; forceSingleProvider?: boolean },
  NeedsMoreAnalysis
> = async (state, input) => {
  try {
    console.log('🔄 Evaluating need for additional providers...');

    // Get data from state
    const mainResult = state.data.mainResult as EvaluationResult;
    const jobSpec = state.data.jobSpec as JobSpec;
    const mode = state.data.mode as AnalysisMode;
    const forceSingleProvider = state.data.forceSingleProvider as boolean | undefined;

    if (!mainResult || !jobSpec) {
      throw new Error('Main result or JobSpec not found in state');
    }

    // In eco mode, never call additional providers
    if (mode === 'eco' || forceSingleProvider) {
      console.log('   Mode: eco or forced single provider - skipping additional providers\n');
      return {
        success: true,
        data: {
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
        },
        stateUpdates: {
          needsMore: false,
          finalDecision: mainResult, // Set finalDecision for single-provider path
          providersRaw: { openai: mainResult },
          providersUsed: ['openai'],
          consensus: {
            level: 'strong' as ConsensusLevel,
            agreement_score: 1.0,
            recommendation_match: true,
            avg_score_delta: 0,
            arbiter_called: false,
          },
        },
      };
    }

    const triggers: any = {
      borderline_score: false,
      weak_evidence: false,
      score_divergence: false,
      must_have_uncertain: false,
      vip_candidate: false,
    };

    const thresholds = jobSpec.thresholds || { consider_min: 60, shortlist_min: 75, years_full_score: 3 };
    const score = mainResult.overall_score_0_to_100;

    // Trigger 1: Borderline score
    if (score >= thresholds.consider_min && score < thresholds.shortlist_min) {
      triggers.borderline_score = true;
    }

    // Trigger 2: Weak evidence
    const evidenceCount = [
      ...mainResult.strengths.flatMap((s) => s.evidence),
      ...mainResult.relevance_summary.by_experience.flatMap((e) => e.evidence),
    ].length;

    if (evidenceCount < UNCERTAINTY_THRESHOLDS.min_evidence_count) {
      triggers.weak_evidence = true;
    }

    // Trigger 3: Score divergence
    const { subscores } = mainResult;
    const scoreDiff = Math.max(
      Math.abs(subscores.experience_years_relevant * 100 - subscores.skills_match_0_to_100),
      Math.abs(subscores.skills_match_0_to_100 - subscores.nice_to_have_0_to_100)
    );

    if (scoreDiff > UNCERTAINTY_THRESHOLDS.subscore_divergence_threshold) {
      triggers.score_divergence = true;
    }

    // Trigger 4: Must-have uncertain
    for (const fail of mainResult.fails) {
      if (fail.evidence.length < UNCERTAINTY_THRESHOLDS.must_have_weak_evidence_threshold) {
        triggers.must_have_uncertain = true;
        break;
      }
    }

    const triggersCount = Object.values(triggers).filter((v) => v).length;
    const confidence = Math.max(0.3, 1 - triggersCount * 0.2);
    const needsMore = triggersCount >= 2 || (mode === 'premium' && triggersCount >= 1);

    console.log(`   Needs more: ${needsMore}`);
    console.log(`   Confidence: ${(confidence * 100).toFixed(0)}%`);
    console.log(`   Triggers: ${Object.entries(triggers).filter(([_, v]) => v).map(([k]) => k).join(', ') || 'none'}\n`);

    const result = {
      needs_more: needsMore,
      triggers,
      confidence,
      recommended_providers: needsMore ? ['gemini', 'claude'] : [],
    };

    // If single provider mode, use mainResult as finalDecision and set all required fields
    const stateUpdates: any = {
      needsMore,
      needsMoreAnalysis: result,
    };

    if (!needsMore && mainResult) {
      console.log('   Using main provider result as final decision (single provider mode)\n');
      stateUpdates.finalDecision = mainResult;
      stateUpdates.aggregationMethod = 'single_provider';

      // Set default consensus for single provider (strong consensus)
      stateUpdates.consensus = {
        level: 'strong',
        delta_overall_score: 0,
        delta_subscores: { experience: 0, skills: 0, nice_to_have: 0 },
        agreement_rate: 1.0,
        disagreements_count: 0,
      };

      // Set empty disagreements array
      stateUpdates.disagreements = [];

      // Calculate total cost and time
      const extractionTime = state.data.extractionTime || 0;
      const evaluationTime = state.data.evaluationTime || 0;
      const mainCost = state.data.mainCost || 0;

      stateUpdates.totalCost = mainCost;
      stateUpdates.totalTime = extractionTime + evaluationTime;
    }

    return {
      success: true,
      data: result,
      stateUpdates,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'needsMore evaluation failed',
    };
  }
};

/**
 * Call additional providers node (Gemini + Claude)
 */
export const callAdditionalProviders: NodeFunction<
  { compactedCV: CV_JSON; jobSpec: JobSpec; mode: AnalysisMode; recommendedProviders: string[] },
  { additionalResults: Record<string, EvaluationResult | null>; additionalCost: number }
> = async (state, input) => {
  try {
    // Get data from state
    const compactedCV = state.data.compactedCV as CV_JSON;
    const jobSpec = state.data.jobSpec as JobSpec;
    const mode = state.data.mode as AnalysisMode;
    const recommendedProviders = state.data.needsMoreAnalysis?.recommended_providers || [];
    const orgAISettings = state.data.orgAISettings as import('@/lib/types').OrgAISettings | null | undefined;

    if (!compactedCV || !jobSpec) {
      throw new Error('Compacted CV or JobSpec not found in state');
    }

    console.log(`🔄 Calling additional providers: ${recommendedProviders.join(', ')}...\n`);

    const additionalProviders: Array<{ name: string; promise: Promise<any> }> = [];

    // Gemini - pass org AI settings for custom instruction injection
    if (recommendedProviders.includes('gemini') || mode === 'premium') {
      try {
        const geminiProvider = createGeminiProvider();
        additionalProviders.push({
          name: 'gemini',
          promise: geminiProvider.analyze(compactedCV, jobSpec, orgAISettings),
        });
      } catch (error) {
        console.warn(`[callAdditionalProviders] Could not create Gemini provider:`, error);
      }
    }

    // Claude - pass org AI settings for custom instruction injection
    if (recommendedProviders.includes('claude') || mode === 'premium') {
      try {
        const claudeProvider = createClaudeProvider();
        additionalProviders.push({
          name: 'claude',
          promise: claudeProvider.analyze(compactedCV, jobSpec, orgAISettings),
        });
      } catch (error) {
        console.warn(`[callAdditionalProviders] Could not create Claude provider:`, error);
      }
    }

    // Wait for all results
    const results = await Promise.all(additionalProviders.map((p) => p.promise));

    const additionalResults: Record<string, EvaluationResult | null> = {};
    let additionalCost = 0;
    const additionalProvidersUsed: string[] = [];

    results.forEach((result, idx) => {
      const providerName = additionalProviders[idx].name;

      if (result.result) {
        additionalResults[providerName] = result.result;
        additionalCost += result.cost_usd || 0;
        additionalProvidersUsed.push(providerName);

        console.log(
          `   ✅ ${providerName}: Score ${result.result.overall_score_0_to_100.toFixed(1)}, Cost $${(result.cost_usd || 0).toFixed(4)}`
        );
      } else {
        console.warn(`   ❌ ${providerName} failed: ${result.error}`);
        additionalResults[providerName] = null;
      }
    });

    console.log(`✅ Additional providers completed\n`);

    return {
      success: true,
      data: { additionalResults, additionalCost },
      stateUpdates: {
        additionalResults,
        additionalCost,
        additionalProvidersUsed,
        providersRaw: {
          ...state.data.providersRaw,
          ...additionalResults,
        },
        providersUsed: [...state.data.providersUsed, ...additionalProvidersUsed],
      },
    };
  } catch (error) {
    // Non-blocking - continue with main result only
    console.warn('[callAdditionalProviders] Failed:', error);
    return {
      success: true,
      data: { additionalResults: {}, additionalCost: 0 },
      stateUpdates: {
        additionalProvidersError: error instanceof Error ? error.message : 'Additional providers failed',
      },
    };
  }
};

/**
 * Aggregate multi-provider results node
 */
export const aggregateResults: NodeFunction<
  { providersRaw: Record<string, EvaluationResult | null> },
  { finalDecision: EvaluationResult; consensus: ConsensusMetrics; disagreements: string[] }
> = async (state, input) => {
  try {
    console.log('🔄 Aggregating multi-provider results...');

    // Get data from state
    const providersRaw = state.data.providersRaw as Record<string, EvaluationResult | null>;

    if (!providersRaw) {
      throw new Error('Providers raw results not found in state');
    }

    const aggregation = aggregateProviderResults(providersRaw as any, {
      useWeights: true,
      minimumProviders: 1,
    });

    console.log(`   Consensus: ${aggregation.consensus.level}`);
    console.log(`   Final score: ${aggregation.final_decision.overall_score_0_to_100.toFixed(1)}/100\n`);

    return {
      success: true,
      data: {
        finalDecision: aggregation.final_decision,
        consensus: aggregation.consensus,
        disagreements: aggregation.disagreements,
      },
      stateUpdates: {
        finalDecision: aggregation.final_decision,
        consensus: aggregation.consensus,
        disagreements: aggregation.disagreements,
        aggregationMethod: 'weighted_average',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Result aggregation failed',
    };
  }
};

/**
 * Call arbiter node (for weak/medium consensus)
 */
export const callArbiter: NodeFunction<
  { providersRaw: Record<string, EvaluationResult | null>; jobSpec: JobSpec; consensus: ConsensusMetrics },
  { arbiterDecision: EvaluationResult; arbiterCost: number }
> = async (state, input) => {
  try {
    // Get data from state
    const providersRaw = state.data.providersRaw as Record<string, EvaluationResult | null>;
    const jobSpec = state.data.jobSpec as JobSpec;
    const consensus = state.data.consensus as ConsensusMetrics;

    if (!providersRaw || !jobSpec || !consensus) {
      throw new Error('Required data not found in state');
    }

    console.log(`🤖 Calling arbiter (consensus: ${consensus.level})...`);

    const arbiterProvider = createOpenAIProvider();
    const arbiterResult = await arbiterProvider.arbitrate!(providersRaw as any, jobSpec);

    const arbiterCost = 0.01; // Estimation

    console.log(`✅ Arbiter completed: Final score ${arbiterResult.overall_score_0_to_100.toFixed(1)}/100\n`);

    const arbiterOutput: ArbiterOutput = {
      final_decision: arbiterResult,
      justification: "Arbitrage réalisé par OpenAI gpt-4o en raison d'un consensus faible/medium",
      arbitrage_summary: 'Arbiter called due to weak/medium consensus',
      resolved_disagreements: [],
      execution_time_ms: 0,
    };

    return {
      success: true,
      data: { arbiterDecision: arbiterResult, arbiterCost },
      stateUpdates: {
        finalDecision: arbiterResult,
        arbiter: arbiterOutput,
        arbiterCost,
        aggregationMethod: 'arbiter',
      },
    };
  } catch (error) {
    // Non-blocking - keep aggregated result
    console.warn('[callArbiter] Arbiter failed, keeping aggregated result:', error);
    return {
      success: true,
      data: { arbiterDecision: state.data.finalDecision, arbiterCost: 0 },
      stateUpdates: {
        arbiterError: error instanceof Error ? error.message : 'Arbiter failed',
      },
    };
  }
};

/**
 * Build context snapshot node
 */
export const buildContextSnapshot: NodeFunction<
  {
    projectId: string;
    jobSpec: JobSpec;
    mode: AnalysisMode;
    enablePrefilter: boolean;
    enablePacking: boolean;
    providersRaw: Record<string, EvaluationResult | null>;
    consensus: ConsensusMetrics;
    arbiter?: ArbiterOutput;
    disagreements: string[];
    totalCost: number;
    totalTime: number;
    extractionTime: number;
    evaluationTime: number;
    candidateId?: string;
    engine?: EngineType;
  },
  { contextSnapshot: any }
> = async (state, input) => {
  try {
    console.log('📸 Building context snapshot...');

    // Get data from state
    const engine = state.data.engine as EngineType;
    const projectId = state.data.projectId as string;
    const jobSpec = state.data.jobSpec as JobSpec;
    const mode = state.data.mode as AnalysisMode;
    const enablePrefilter = state.data.enablePrefilter as boolean;
    const enablePacking = state.data.enablePacking as boolean;
    const providersRaw = state.data.providersRaw as Record<string, EvaluationResult | null>;
    const consensus = state.data.consensus as ConsensusMetrics;
    const disagreements = state.data.disagreements || [];
    const arbiter = state.data.arbiter as ArbiterOutput | undefined;
    const candidateId = state.data.candidateId as string | undefined;
    const totalCost = state.data.totalCost || 0;
    const totalTime = state.metadata.totalTime || 0;
    const extractionTime = state.data.extractionTime || 0;
    const evaluationTime = state.data.evaluationTime || 0;

    const contextBuilder = new ContextSnapshotBuilder(engine);

    // Set job context
    contextBuilder.setJobContext(projectId, jobSpec.title, hashJobSpec(jobSpec));

    // Set mode
    contextBuilder.setMode(mode, enablePrefilter, enablePacking);

    // Add provider calls
    const startTime = Date.now() - totalTime;

    if (providersRaw.openai) {
      contextBuilder.addProviderCall({
        name: 'openai',
        model: 'gpt-4o',
        called_at: new Date(startTime).toISOString(),
        duration_ms: evaluationTime,
        cost_usd: state.data.mainCost || 0,
        status: 'success',
      });
    }

    if (providersRaw.gemini) {
      contextBuilder.addProviderCall({
        name: 'gemini',
        model: 'gemini-2.0-flash-exp',
        called_at: new Date(startTime + evaluationTime).toISOString(),
        duration_ms: 5000,
        cost_usd: 0.015,
        status: 'success',
      });
    }

    if (providersRaw.claude) {
      contextBuilder.addProviderCall({
        name: 'claude',
        model: 'claude-sonnet-4-5-20250929',
        called_at: new Date(startTime + evaluationTime).toISOString(),
        duration_ms: 5000,
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
    if (candidateId) {
      await contextBuilder.setConsentFromDB(candidateId);
      await contextBuilder.setMaskingLevelFromDB(projectId);
    } else {
      contextBuilder.setCompliance('none', false);
    }

    const contextSnapshot = contextBuilder.complete();

    console.log('✅ Context snapshot built\n');

    return {
      success: true,
      data: { contextSnapshot },
      stateUpdates: {
        contextSnapshot,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Context snapshot build failed',
    };
  }
};

/**
 * Cache result node
 */
export const cacheResult: NodeFunction<
  { cacheKey: string; result: any },
  { cached: boolean }
> = async (state, input) => {
  try {
    console.log('💾 Caching result...');

    const cache = getCacheStore();
    await cache.set(input.cacheKey, input.result, 3600); // TTL: 1 hour

    console.log(`✅ Result cached for 1 hour (key: ${input.cacheKey.substring(0, 40)}...)\n`);

    return {
      success: true,
      data: { cached: true },
      stateUpdates: {
        resultCached: true,
      },
    };
  } catch (error) {
    // Non-blocking - continue without caching
    console.warn('[cacheResult] Caching failed:', error);
    return {
      success: true,
      data: { cached: false },
      stateUpdates: {
        cacheError: error instanceof Error ? error.message : 'Caching failed',
      },
    };
  }
};
