/**
 * MCP Quality Module - Exports centralisés
 *
 * Point #5: Evidence Quality Gating
 * Point #6: Smart Cost Triggering
 */

// ============================================================================
// Point #5: Evidence Quality Gating
// ============================================================================

export {
  scoreEvidence,
  scoreEvidenceQuality,
  extractAllEvidences,
} from './evidence-scorer';

export {
  applyQualityGating,
  validateEvidenceQuality,
  filterEvidencesByQuality,
} from './quality-gating';

// ============================================================================
// Point #6: Smart Cost Triggering
// ============================================================================

export {
  scoreExtractionConfidence,
} from './extraction-confidence';

export {
  optimizeAnalysisMode,
  calculateCostMetrics,
  recommendMode,
} from './cost-optimizer';

// ============================================================================
// Types
// ============================================================================

export type {
  EvidenceQualityScore,
  EvidenceQualityResult,
  QualityGatingConfig,
  QualityGatingDecision,
  ExtractionConfidenceScore,
  ModeAdjustmentDecision,
  CostOptimizerConfig,
  CostMetrics,
} from './types';

export {
  DEFAULT_QUALITY_GATING_CONFIG,
  DEFAULT_COST_OPTIMIZER_CONFIG,
} from './types';
