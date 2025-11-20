/**
 * CoreMatch CV Analysis - Point d'entrée principal
 *
 * Phase 1: Fondations (types, config, utils, validators)
 * Phase 2: Pipeline core (prefilter, packer, rules, providers, orchestrator)
 */

// ============================================================================
// Phase 1: Fondations
// ============================================================================

// Types
export type * from './types';

// Config
export * from './config';

// Utils
export * from './utils';
export { generateJobSpec, validateJobSpec } from './utils/jobspec-generator';

// Validators
export * from './validators';

// Providers (base)
export * from './providers/base-provider';

// ============================================================================
// Phase 2: Pipeline Core
// ============================================================================

// Orchestrator (point d'entrée principal)
export { orchestrateAnalysis, type OrchestrationOptions } from './orchestrator';

// Graph-based orchestration (NEW - recommended)
export { analyzeCVWithGraph, createCVAnalysisGraph } from '@/lib/graph/graphs/cv-analysis';

// Prefilter
export { prefilterCV, shouldPrefilter, interpretSoftFlags } from './prefilter/stage0-prefilter';

// Packer
export { packContext, buildCompactedCV, estimateTokenSavings } from './packer/context-packer';

// Rules
export * from './rules';

// Providers (implémentations)
export { OpenAIProvider, createOpenAIProvider } from './providers/openai-provider';
export { GeminiProvider, createGeminiProvider } from './providers/gemini-provider';
export { ClaudeProvider, createClaudeProvider } from './providers/claude-provider';

// Aggregator
export { aggregateProviderResults } from './aggregator/multi-provider-aggregator';
