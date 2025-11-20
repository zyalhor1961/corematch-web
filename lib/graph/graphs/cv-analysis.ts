/**
 * CV Analysis Graph
 * Complete workflow for CV analysis with multi-provider support
 */

import { createGraph, createNode } from '../core/graph';
import type { Graph } from '../core/types';
import type { AnalysisMode, AggregatedResult, JobSpec, OrchestrationOptions, EvaluationResult } from '@/lib/cv-analysis/types';
import * as CVNodes from '../nodes/cv';

/**
 * Create CV Analysis Graph
 */
export function createCVAnalysisGraph(): Graph {
  // Wrap node functions with createNode
  const initNode = createNode('init', 'Initialize Validators', CVNodes.initializeValidators);

  const cacheCheckNode = createNode('cacheCheck', 'Check Cache', CVNodes.checkCache);

  const extractNode = createNode('extract', 'Extract CV', CVNodes.extractCV, {
    type: 'extract',
    retry: { maxAttempts: 2, delayMs: 1000 },
    timeout: 60000, // 60 seconds (OpenAI can be slow)
  });

  const validateNode = createNode('validate', 'Validate CV', CVNodes.validateCV, {
    type: 'validate',
  });

  const prefilterNode = createNode('prefilter', 'Prefilter CV (Stage 0)', CVNodes.prefilterCVNode, {
    type: 'validate',
  });

  const packNode = createNode('pack', 'Pack Context', CVNodes.packContextNode, {
    type: 'transform',
  });

  const analyzeMainNode = createNode('analyzeMain', 'Analyze (Main Provider)', CVNodes.analyzeMainProvider, {
    type: 'custom',
    retry: { maxAttempts: 2, delayMs: 2000 },
    timeout: 60000,
  });

  const evaluateNeedsMoreNode = createNode('evaluateNeedsMore', 'Evaluate Need for More Providers', CVNodes.evaluateNeedsMore);

  const callAdditionalNode = createNode('callAdditional', 'Call Additional Providers', CVNodes.callAdditionalProviders, {
    type: 'custom',
    timeout: 90000,
  });

  const aggregateNode = createNode('aggregate', 'Aggregate Results', CVNodes.aggregateResults, {
    type: 'custom',
  });

  const arbiterNode = createNode('arbiter', 'Call Arbiter', CVNodes.callArbiter, {
    type: 'custom',
    timeout: 30000,
  });

  const snapshotNode = createNode('snapshot', 'Build Context Snapshot', CVNodes.buildContextSnapshot);

  const cacheResultNode = createNode('cacheResult', 'Cache Result', CVNodes.cacheResult);

  const completeNode = createNode('complete', 'Complete Analysis', async (state, input) => {
    // Handle early exit (e.g., prefilter rejection)
    if (state.data.earlyExit && !state.data.finalDecision) {
      console.log('🚫 Early exit - Creating rejection decision');

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
        fails: state.data.prefilterReasons
          ? state.data.prefilterReasons.map((reason: string, idx: number) => ({
              must_have_id: `PREFILTER_${idx}`,
              reason,
              evidence: [],
            }))
          : [
              {
                must_have_id: 'PREFILTER_REJECT',
                reason: 'CV rejected by prefilter (Stage 0)',
                evidence: [],
              },
            ],
        timestamp: new Date().toISOString(),
      };

      state.data.finalDecision = rejectionDecision;
      state.data.providersUsed = state.data.providersUsed || [];
      state.data.providersRaw = state.data.providersRaw || {};
    }

    console.log('════════════════════════════════════════════════');
    console.log(`✅ CV ANALYSIS COMPLETE`);
    console.log(`   Total time: ${state.metadata.totalTime || 0}ms`);
    console.log(`   Total cost: $${state.data.totalCost?.toFixed(4) || '0.0000'}`);
    console.log(`   Recommendation: ${state.data.finalDecision?.recommendation || 'N/A'}`);
    console.log(`   Score: ${state.data.finalDecision?.overall_score_0_to_100?.toFixed(1) || 0}/100`);
    console.log('════════════════════════════════════════════════\n');

    return {
      success: true,
      stateUpdates: {
        completed: true,
      },
    };
  });

  // Build the graph
  const graph = createGraph('cv-analysis', 'CV Analysis Workflow', 'Multi-provider CV analysis with cache and consensus')
    .addNode(initNode)
    .addNode(cacheCheckNode)
    .addNode(extractNode)
    .addNode(validateNode)
    .addNode(prefilterNode)
    .addNode(packNode)
    .addNode(analyzeMainNode)
    .addNode(evaluateNeedsMoreNode)
    .addNode(callAdditionalNode)
    .addNode(aggregateNode)
    .addNode(arbiterNode)
    .addNode(snapshotNode)
    .addNode(cacheResultNode)
    .addNode(completeNode)
    .setEntry('init')

    // Sequential flow: init → cacheCheck
    .addEdge('init', 'cacheCheck')

    // If cache hit → complete (early exit)
    .addEdge('cacheCheck', 'complete', (state) => state.data.cacheHit === true, 'cache hit')

    // If cache miss → extract
    .addEdge('cacheCheck', 'extract', (state) => state.data.cacheHit === false, 'cache miss')

    // extract → validate
    .addEdge('extract', 'validate')

    // Conditional: only prefilter in balanced/premium mode with prefilter enabled
    .addEdge(
      'validate',
      'prefilter',
      (state) => {
        const mode = state.data.mode || 'eco';
        const enablePrefilter = state.data.enablePrefilter !== false;
        const shouldPrefilter = enablePrefilter && (mode === 'balanced' || mode === 'premium');
        console.log(`[Graph Edge] validate → ? | mode=${mode}, enablePrefilter=${enablePrefilter}, shouldPrefilter=${shouldPrefilter}`);
        return shouldPrefilter;
      },
      'balanced/premium mode with prefilter'
    )

    // Default: skip prefilter, go directly to pack
    .addEdge(
      'validate',
      'pack',
      (state) => {
        const mode = state.data.mode || 'eco';
        const enablePrefilter = state.data.enablePrefilter !== false;
        const skipPrefilter = mode === 'eco' || !enablePrefilter;
        console.log(`[Graph Edge] validate → pack | mode=${mode}, enablePrefilter=${enablePrefilter}, skipPrefilter=${skipPrefilter}`);
        return skipPrefilter;
      },
      'eco mode or no prefilter'
    )

    // If prefilter fails → complete (early exit)
    .addEdge('prefilter', 'complete', (state) => state.data.earlyExit === true, 'prefilter failed')

    // If prefilter passes → pack
    .addEdge('prefilter', 'pack', (state) => state.data.earlyExit !== true, 'prefilter passed')

    // pack → analyzeMain → evaluateNeedsMore
    .addEdge('pack', 'analyzeMain')
    .addEdge('analyzeMain', 'evaluateNeedsMore')

    // If needsMore → callAdditional
    .addEdge('evaluateNeedsMore', 'callAdditional', (state) => state.data.needsMore === true, 'needs more providers')

    // If not needsMore → use main result as final (skip to snapshot)
    .addEdge('evaluateNeedsMore', 'snapshot', (state) => state.data.needsMore === false, 'single provider')

    // callAdditional → aggregate
    .addEdge('callAdditional', 'aggregate')

    // If consensus weak/medium → arbiter
    .addEdge(
      'aggregate',
      'arbiter',
      (state) => {
        const consensus = state.data.consensus?.level || 'strong';
        const mode = state.data.mode || 'eco';
        return consensus === 'weak' || (mode === 'premium' && consensus === 'medium');
      },
      'weak/medium consensus'
    )

    // If consensus strong (or balanced mode + medium) → skip arbiter
    .addEdge(
      'aggregate',
      'snapshot',
      (state) => {
        const consensus = state.data.consensus?.level || 'strong';
        const mode = state.data.mode || 'eco';
        return consensus === 'strong' || (mode === 'balanced' && consensus === 'medium');
      },
      'strong consensus'
    )

    // arbiter → snapshot
    .addEdge('arbiter', 'snapshot')

    // snapshot → cacheResult → complete
    .addEdge('snapshot', 'cacheResult')
    .addEdge('cacheResult', 'complete')

    .addExit('complete')
    .build();

  return graph;
}

/**
 * Execute CV analysis using graph orchestration
 */
export async function analyzeCVWithGraph(
  cvText: string,
  jobSpec: JobSpec,
  options: Omit<OrchestrationOptions, 'engine'>
): Promise<AggregatedResult> {
  const startTime = Date.now();

  console.log('\n════════════════════════════════════════════════');
  console.log(`🎬 CV ANALYSIS GRAPH: Starting in ${options.mode.toUpperCase()} mode`);
  console.log(`   Job: ${jobSpec.title}`);
  console.log('════════════════════════════════════════════════\n');

  const graph = createCVAnalysisGraph();

  const { executeGraph } = await import('../core/executor');

  const result = await executeGraph(graph, {
    initialData: {
      cvText,
      jobSpec,
      projectId: options.projectId,
      mode: options.mode,
      enablePrefilter: options.enablePrefilter,
      enablePacking: options.enablePacking,
      forceSingleProvider: options.forceSingleProvider,
      analysisDate: options.analysisDate,
      candidateId: options.candidateId,
      engine: 'corematch-v2-graph',
    },
    verbose: true,
    metadata: {
      startTime,
    },
    onNodeComplete: (nodeId, nodeResult) => {
      // Optional: Add custom logging or metrics
    },
    onError: (error) => {
      console.error(`❌ Graph error in node ${error.node}:`, error.message);
    },
  });

  // If cache hit, return cached result directly
  if (result.finalState.data.cacheHit && result.finalState.data.cachedResult) {
    return result.finalState.data.cachedResult;
  }

  // Check if graph completed successfully
  if (!result.success || !result.finalState.data.finalDecision) {
    console.error('❌ Graph execution failed or incomplete');
    console.error('   Final state:', JSON.stringify(result.finalState.data, null, 2));
    throw new Error('Graph execution did not complete successfully. Check logs for details.');
  }

  // Build final aggregated result
  const totalTime = Date.now() - startTime;

  const finalResult: AggregatedResult = {
    final_decision: result.finalState.data.finalDecision,
    providers_raw: result.finalState.data.providersRaw || {},
    consensus: result.finalState.data.consensus || {
      level: 'strong',
      delta_overall_score: 0,
      delta_subscores: { experience: 0, skills: 0, nice_to_have: 0 },
      agreement_rate: 1.0,
      disagreements_count: 0,
    },
    arbiter: result.finalState.data.arbiter,
    debug: {
      mode: options.mode,
      providers_used: result.finalState.data.providersUsed || ['openai'],
      aggregation_method: result.finalState.data.aggregationMethod || 'single_provider',
      model_disagreements: result.finalState.data.disagreements || [],
      early_exit: result.finalState.data.earlyExit || false,
      reasons_for_multi_provider: result.finalState.data.needsMore
        ? Object.entries(result.finalState.data.needsMoreAnalysis?.triggers || {})
            .filter(([_, v]) => v)
            .map(([k]) => k)
        : undefined,
    },
    performance: {
      total_execution_time_ms: totalTime,
      prefilter_time_ms: result.finalState.data.prefilterTime,
      extraction_time_ms: result.finalState.data.extractionTime,
      evaluation_time_ms: result.finalState.data.evaluationTime,
    },
    cost: {
      total_usd:
        (result.finalState.data.mainCost || 0) +
        (result.finalState.data.additionalCost || 0) +
        (result.finalState.data.arbiterCost || 0),
      by_provider: {
        openai: result.finalState.data.mainCost || 0,
        gemini: result.finalState.data.providersRaw?.gemini ? 0.015 : 0,
        claude: result.finalState.data.providersRaw?.claude ? 0.018 : 0,
      },
      by_stage: {
        extraction: 0.002,
        evaluation:
          (result.finalState.data.mainCost || 0) +
          (result.finalState.data.additionalCost || 0) +
          (result.finalState.data.arbiterCost || 0) -
          0.002,
      },
    },
    context_snapshot: result.finalState.data.contextSnapshot,
  };

  return finalResult;
}
