/**
 * Phase 4: Monitoring and Quality Assurance Types
 *
 * Cost optimization, quality validation, and metrics tracking
 */

// ============================================================================
// Cost Optimization
// ============================================================================

export interface CostBudget {
  max_cost_usd: number;           // Maximum cost allowed
  warn_threshold_pct: number;     // Warn at X% of budget (e.g., 0.8 = 80%)
  mode: 'strict' | 'flexible';    // strict = fail if exceeded, flexible = warn only
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  provider: string;
  model: string;
  timestamp: string;
}

export interface CostMetrics {
  total_cost_usd: number;
  budget_used_pct: number;          // Percentage of budget used
  cost_by_provider: Record<string, number>;
  cost_by_operation: Record<string, number>;  // extract, analyze, arbitrate
  token_usage: TokenUsage[];
  cache_savings_usd: number;        // Money saved by cache hits
  avg_cost_per_analysis: number;
  timestamp: string;
}

export interface ProviderSelectionStrategy {
  mode: 'cost_optimized' | 'quality_optimized' | 'balanced';
  budget?: CostBudget;
  preferred_providers?: string[];   // Ordered by preference
  fallback_enabled: boolean;
}

// ============================================================================
// Quality Assurance
// ============================================================================

export type QualityLevel = 'high' | 'medium' | 'low' | 'critical';

export interface QualityFlag {
  type: 'missing_evidence' | 'low_confidence' | 'inconsistent_scoring' | 'suspicious_pattern' | 'incomplete_analysis';
  severity: QualityLevel;
  message: string;
  field_path?: string;              // e.g., "final_decision.fails[0].evidence"
  suggestion?: string;              // How to fix
  requires_human_review: boolean;
}

export interface ConfidenceScore {
  overall: number;                  // 0-1
  evidence_quality: number;         // 0-1 (based on quote precision)
  consistency: number;              // 0-1 (cross-provider agreement)
  completeness: number;             // 0-1 (all fields populated)
  breakdown: Record<string, number>;
}

export interface QualityAssessment {
  quality_level: QualityLevel;
  confidence_score: ConfidenceScore;
  flags: QualityFlag[];
  requires_human_review: boolean;
  validation_errors: string[];
  recommendations: string[];
  timestamp: string;
}

// ============================================================================
// Cache Monitoring
// ============================================================================

export interface CacheMetrics {
  total_requests: number;
  cache_hits: number;
  cache_misses: number;
  hit_rate_pct: number;             // cache_hits / total_requests
  avg_cache_lookup_ms: number;
  cache_size_items: number;
  cache_evictions: number;
  cost_saved_usd: number;           // Estimated savings from cache hits
  timestamp: string;
}

// ============================================================================
// Performance Monitoring
// ============================================================================

export interface PerformanceMetrics {
  total_duration_ms: number;
  node_durations: Record<string, number>;
  slowest_node: { node: string; duration_ms: number };
  api_call_count: number;
  api_latencies: { provider: string; latency_ms: number }[];
  retry_count: number;
  timestamp: string;
}

// ============================================================================
// Alert System
// ============================================================================

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  type: 'budget_exceeded' | 'quality_issue' | 'performance_degradation' | 'error_rate_high';
  message: string;
  details: Record<string, any>;
  timestamp: string;
  resolved: boolean;
}

// ============================================================================
// Comprehensive Monitoring Report
// ============================================================================

export interface MonitoringReport {
  execution_id: string;
  cost_metrics: CostMetrics;
  quality_assessment: QualityAssessment;
  cache_metrics: CacheMetrics;
  performance_metrics: PerformanceMetrics;
  alerts: Alert[];
  timestamp: string;
}

// ============================================================================
// Configuration
// ============================================================================

export interface MonitoringConfig {
  cost_optimization: {
    enabled: boolean;
    budget?: CostBudget;
    strategy: ProviderSelectionStrategy;
  };
  quality_assurance: {
    enabled: boolean;
    min_confidence: number;         // Fail if confidence < threshold
    strict_validation: boolean;
    auto_flag_low_quality: boolean;
  };
  performance: {
    enabled: boolean;
    max_duration_ms?: number;
    alert_on_slow_node_ms?: number;
  };
  alerts: {
    enabled: boolean;
    webhooks?: string[];            // Send alerts to webhooks
  };
}

export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  cost_optimization: {
    enabled: true,
    strategy: {
      mode: 'balanced',
      fallback_enabled: true,
    },
  },
  quality_assurance: {
    enabled: true,
    min_confidence: 0.6,
    strict_validation: false,
    auto_flag_low_quality: true,
  },
  performance: {
    enabled: true,
    max_duration_ms: 60000,         // 60 seconds
    alert_on_slow_node_ms: 10000,   // 10 seconds
  },
  alerts: {
    enabled: true,
  },
};
