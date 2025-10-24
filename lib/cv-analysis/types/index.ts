/**
 * Types centralisés pour le système d'analyse CV CoreMatch
 *
 * Architecture:
 * - cv.types.ts: Structures CV (extraction)
 * - evaluation.types.ts: Évaluation et scoring
 * - consensus.types.ts: Multi-provider et agrégation
 */

// Export tous les types CV
export type {
  CV_Identity,
  CV_Experience,
  CV_Formation,
  CV_Langue,
  CV_Certification,
  CV_Projet,
  CV_JSON,
  CV_ExtractionMetadata,
} from './cv.types';

// Export tous les types Evaluation
export type {
  MustHaveRule,
  RelevanceRules,
  Weights,
  Thresholds,
  JobSpec,
  Evidence,
  EvidenceQualityScore,
  FailedRule,
  RelevanceLevel,
  ExperienceRelevance,
  RelevanceSummary,
  Subscores,
  Strength,
  Improvement,
  Recommendation,
  EvaluationResult,
  EvaluationMetadata,
} from './evaluation.types';

// Export tous les types Consensus
export type {
  AnalysisMode,
  AnalysisModeConfig,
  ProviderName,
  ProviderConfig,
  ProviderResult,
  ConsensusLevel,
  ModelDisagreement,
  ConsensusMetrics,
  PrefilterResult,
  PackedSection,
  PackedContext,
  QuantitativeAggregate,
  ArbiterInput,
  ArbiterOutput,
  AggregatedResult,
  UncertaintyTriggers,
  NeedsMoreAnalysis,
} from './consensus.types';
