/**
 * Corematch MCP Module - Exports centralisés
 *
 * Usage:
 * import { generateCacheKey, maskPII, ContextSnapshot } from '@/lib/mcp';
 */

// ============================================================================
// Cache
// ============================================================================

export {
  generateCacheKey,
  hashCV,
  hashCVText,
  hashJobSpec,
  hashObject,
  parseCacheKey,
  areJobSpecsEqual,
  areCVsEqual,
} from './cache/cache-key';

export type { CacheKeyOptions } from './cache/cache-key';

export {
  getCacheStore,
  resetCacheStore,
  InMemoryCacheStore,
} from './cache/cache-store';

export type { CacheStore } from './cache/cache-store';

// ============================================================================
// Security / PII Masking
// ============================================================================

export {
  maskPII,
  isMasked,
  detectMaskingLevel,
  checkMCPConsent,
  updateMCPConsent,
  getProjectPIIMaskingLevel,
  validateAnalysisRequest,
} from './security/pii-masking';

export type { MaskingStats } from './security/pii-masking';

// ============================================================================
// Types
// ============================================================================

export {
  ContextSnapshotBuilder,
  createContextSnapshot,
} from './types/context-snapshot';

export type {
  ContextSnapshot,
  ProviderCallDetails,
  PIIMaskingLevel,
} from './types/context-snapshot';

// ============================================================================
// Resilience
// ============================================================================

export {
  resilientCall,
  withRetry,
  retryOnRateLimit,
  retryOnNetworkError,
  CircuitBreaker,
  getCircuitBreaker,
  resetAllCircuitBreakers,
  withTimeout,
  withAdaptiveTimeout,
  delay,
  CircuitBreakerOpenError,
  TimeoutError,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './resilience';

export type {
  RetryConfig,
  CircuitBreakerConfig,
  CircuitState,
  CircuitBreakerStats,
  ResilientCallOptions,
} from './resilience';

// ============================================================================
// Quality (Evidence Gating + Cost Optimization)
// ============================================================================

export {
  // Point #5: Evidence Quality Gating
  scoreEvidence,
  scoreEvidenceQuality,
  extractAllEvidences,
  applyQualityGating,
  validateEvidenceQuality,
  filterEvidencesByQuality,
  // Point #6: Smart Cost Triggering
  scoreExtractionConfidence,
  optimizeAnalysisMode,
  calculateCostMetrics,
  recommendMode,
  DEFAULT_QUALITY_GATING_CONFIG,
  DEFAULT_COST_OPTIMIZER_CONFIG,
} from './quality';

export type {
  EvidenceQualityScore,
  EvidenceQualityResult,
  QualityGatingConfig,
  QualityGatingDecision,
  ExtractionConfidenceScore,
  ModeAdjustmentDecision,
  CostOptimizerConfig,
  CostMetrics,
} from './quality';
