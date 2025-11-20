/**
 * Monitoring Manager - Phase 4
 *
 * Unified interface for cost optimization, quality assurance, and performance monitoring
 */

export * from './types';
export * from './cost-optimizer';
export * from './quality-validator';
export * from './cache-tracker';

import type {
  MonitoringConfig,
  MonitoringReport,
  PerformanceMetrics,
  Alert,
} from './types';
import { CostOptimizer } from './cost-optimizer';
import { QualityValidator } from './quality-validator';
import { CacheTracker } from './cache-tracker';
import type { EvaluationResult } from '@/lib/cv-analysis/types';

export class MonitoringManager {
  private costOptimizer: CostOptimizer;
  private qualityValidator: QualityValidator;
  private cacheTracker: CacheTracker;
  private startTime: number;
  private nodeDurations: Map<string, number> = new Map();
  private apiCallCount: number = 0;
  private apiLatencies: Array<{ provider: string; latency_ms: number }> = [];
  private retryCount: number = 0;

  constructor(private config: MonitoringConfig) {
    this.costOptimizer = new CostOptimizer(
      config.cost_optimization.budget,
      config.cost_optimization.strategy
    );

    this.qualityValidator = new QualityValidator(
      config.quality_assurance.min_confidence,
      config.quality_assurance.strict_validation
    );

    this.cacheTracker = new CacheTracker();
    this.startTime = Date.now();
  }

  /**
   * Get cost optimizer instance
   */
  getCostOptimizer(): CostOptimizer {
    return this.costOptimizer;
  }

  /**
   * Get quality validator instance
   */
  getQualityValidator(): QualityValidator {
    return this.qualityValidator;
  }

  /**
   * Get cache tracker instance
   */
  getCacheTracker(): CacheTracker {
    return this.cacheTracker;
  }

  /**
   * Record node execution
   */
  recordNodeExecution(nodeId: string, durationMs: number): void {
    this.nodeDurations.set(nodeId, durationMs);
  }

  /**
   * Record API call
   */
  recordAPICall(provider: string, latencyMs: number): void {
    this.apiCallCount++;
    this.apiLatencies.push({ provider, latency_ms: latencyMs });
  }

  /**
   * Record retry
   */
  recordRetry(): void {
    this.retryCount++;
  }

  /**
   * Generate comprehensive monitoring report
   */
  generateReport(
    executionId: string,
    finalResult: EvaluationResult,
    providersRaw?: Record<string, EvaluationResult>,
    consensus?: any
  ): MonitoringReport {
    const alerts: Alert[] = [];

    // Get cost metrics
    const costMetrics = this.costOptimizer.getMetrics();

    // Check budget alerts
    if (this.config.cost_optimization.enabled) {
      alerts.push(...this.costOptimizer.checkBudget());
    }

    // Get quality assessment
    const qualityAssessment = this.config.quality_assurance.enabled
      ? this.qualityValidator.validate(finalResult, providersRaw, consensus)
      : {
          quality_level: 'medium' as const,
          confidence_score: {
            overall: 0.8,
            evidence_quality: 0.8,
            consistency: 0.8,
            completeness: 0.8,
            breakdown: {},
          },
          flags: [],
          requires_human_review: false,
          validation_errors: [],
          recommendations: [],
          timestamp: new Date().toISOString(),
        };

    // Get cache metrics
    const cacheMetrics = this.cacheTracker.getMetrics();

    // Get performance metrics
    const performanceMetrics = this.getPerformanceMetrics();

    // Performance alerts
    if (this.config.performance.enabled) {
      if (
        this.config.performance.max_duration_ms &&
        performanceMetrics.total_duration_ms > this.config.performance.max_duration_ms
      ) {
        alerts.push({
          id: `perf-${Date.now()}`,
          severity: 'warning',
          type: 'performance_degradation',
          message: `Analysis exceeded max duration: ${performanceMetrics.total_duration_ms}ms > ${this.config.performance.max_duration_ms}ms`,
          details: {
            total_duration: performanceMetrics.total_duration_ms,
            max_duration: this.config.performance.max_duration_ms,
            slowest_node: performanceMetrics.slowest_node,
          },
          timestamp: new Date().toISOString(),
          resolved: false,
        });
      }
    }

    // Quality alerts
    if (this.config.quality_assurance.enabled && this.config.quality_assurance.auto_flag_low_quality) {
      if (qualityAssessment.quality_level === 'low' || qualityAssessment.quality_level === 'critical') {
        alerts.push({
          id: `quality-${Date.now()}`,
          severity: qualityAssessment.quality_level === 'critical' ? 'critical' : 'warning',
          type: 'quality_issue',
          message: `Low quality analysis detected: ${qualityAssessment.quality_level}`,
          details: {
            confidence: qualityAssessment.confidence_score.overall,
            flags: qualityAssessment.flags.length,
            requires_review: qualityAssessment.requires_human_review,
          },
          timestamp: new Date().toISOString(),
          resolved: false,
        });
      }
    }

    return {
      execution_id: executionId,
      cost_metrics: costMetrics,
      quality_assessment: qualityAssessment,
      cache_metrics: cacheMetrics,
      performance_metrics: performanceMetrics,
      alerts,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get performance metrics
   */
  private getPerformanceMetrics(): PerformanceMetrics {
    const totalDuration = Date.now() - this.startTime;
    const nodeDurationsObj: Record<string, number> = {};

    let slowestNode = { node: '', duration_ms: 0 };
    for (const [node, duration] of this.nodeDurations.entries()) {
      nodeDurationsObj[node] = duration;
      if (duration > slowestNode.duration_ms) {
        slowestNode = { node, duration_ms: duration };
      }
    }

    return {
      total_duration_ms: totalDuration,
      node_durations: nodeDurationsObj,
      slowest_node: slowestNode,
      api_call_count: this.apiCallCount,
      api_latencies: this.apiLatencies,
      retry_count: this.retryCount,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Print monitoring summary
   */
  printSummary(report: MonitoringReport): void {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 MONITORING REPORT');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Cost Summary
    console.log('💰 COST METRICS:');
    console.log(`   Total Cost: $${report.cost_metrics.total_cost_usd.toFixed(4)}`);
    if (report.cost_metrics.budget_used_pct > 0) {
      console.log(`   Budget Used: ${(report.cost_metrics.budget_used_pct * 100).toFixed(1)}%`);
    }
    console.log(`   Cache Savings: $${report.cost_metrics.cache_savings_usd.toFixed(4)}`);
    console.log(`   Providers: ${Object.keys(report.cost_metrics.cost_by_provider).join(', ')}`);

    // Quality Summary
    console.log('\n✅ QUALITY ASSESSMENT:');
    console.log(`   Level: ${report.quality_assessment.quality_level.toUpperCase()}`);
    console.log(`   Overall Confidence: ${(report.quality_assessment.confidence_score.overall * 100).toFixed(1)}%`);
    console.log(`   Evidence Quality: ${(report.quality_assessment.confidence_score.evidence_quality * 100).toFixed(1)}%`);
    console.log(`   Consistency: ${(report.quality_assessment.confidence_score.consistency * 100).toFixed(1)}%`);
    console.log(`   Requires Review: ${report.quality_assessment.requires_human_review ? 'YES ⚠️' : 'NO ✓'}`);
    if (report.quality_assessment.flags.length > 0) {
      console.log(`   Quality Flags: ${report.quality_assessment.flags.length}`);
    }

    // Cache Summary
    console.log('\n💾 CACHE METRICS:');
    console.log(`   Hit Rate: ${report.cache_metrics.hit_rate_pct.toFixed(1)}%`);
    console.log(`   Hits/Misses: ${report.cache_metrics.cache_hits}/${report.cache_metrics.cache_misses}`);
    console.log(`   Avg Lookup: ${report.cache_metrics.avg_cache_lookup_ms.toFixed(2)}ms`);

    // Performance Summary
    console.log('\n⚡ PERFORMANCE:');
    console.log(`   Total Duration: ${report.performance_metrics.total_duration_ms}ms`);
    console.log(`   API Calls: ${report.performance_metrics.api_call_count}`);
    if (report.performance_metrics.slowest_node.node) {
      console.log(`   Slowest Node: ${report.performance_metrics.slowest_node.node} (${report.performance_metrics.slowest_node.duration_ms}ms)`);
    }

    // Alerts
    if (report.alerts.length > 0) {
      console.log('\n🚨 ALERTS:');
      for (const alert of report.alerts) {
        const icon = alert.severity === 'critical' ? '🔴' : alert.severity === 'error' ? '🟠' : '🟡';
        console.log(`   ${icon} [${alert.severity.toUpperCase()}] ${alert.message}`);
      }
    }

    // Recommendations
    if (report.quality_assessment.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      for (const rec of report.quality_assessment.recommendations) {
        console.log(`   • ${rec}`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');
  }
}

/**
 * Factory function
 */
export function createMonitoringManager(config: Partial<MonitoringConfig>): MonitoringManager {
  const fullConfig: MonitoringConfig = {
    cost_optimization: {
      enabled: true,
      strategy: { mode: 'balanced', fallback_enabled: true },
      ...config.cost_optimization,
    },
    quality_assurance: {
      enabled: true,
      min_confidence: 0.6,
      strict_validation: false,
      auto_flag_low_quality: true,
      ...config.quality_assurance,
    },
    performance: {
      enabled: true,
      max_duration_ms: 60000,
      alert_on_slow_node_ms: 10000,
      ...config.performance,
    },
    alerts: {
      enabled: true,
      ...config.alerts,
    },
  };

  return new MonitoringManager(fullConfig);
}
