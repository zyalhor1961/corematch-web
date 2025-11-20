# Phase 4: Cost Optimization + Quality Assurance - Guide

## Overview

Phase 4 adds production-grade monitoring, cost control, and quality validation to the graph orchestration system. These features ensure reliable, cost-effective, and high-quality AI operations.

## Features

### 1. Cost Optimization

**Smart Provider Selection** - Automatically selects optimal AI provider based on budget constraints and optimization strategy.

```typescript
import { createMonitoringManager, type CostBudget } from '@/lib/graph/monitoring';

const budget: CostBudget = {
  max_cost_usd: 0.10,          // $0.10 maximum
  warn_threshold_pct: 0.80,    // Warn at 80%
  mode: 'strict',              // fail | flexible
};

const monitor = createMonitoringManager({
  cost_optimization: {
    enabled: true,
    budget,
    strategy: {
      mode: 'cost_optimized',  // cost_optimized | quality_optimized | balanced
      fallback_enabled: true,
    },
  },
});

// Smart provider selection
const costOptimizer = monitor.getCostOptimizer();
const selection = costOptimizer.selectProvider('balanced', 'analyze');
// Returns: { provider: 'gemini', model: 'gemini-1.5-flash', reason: '...' }
```

**Token Usage Tracking** - Track token consumption and calculate costs in real-time.

```typescript
// Track token usage
costOptimizer.trackTokenUsage(
  'openai',           // provider
  'gpt-4o',          // model
  2500,              // input tokens
  1200,              // output tokens
  'analyze'          // operation
);

// Check budget status
const alerts = costOptimizer.checkBudget();
// Returns alerts if budget threshold exceeded

// Get cost metrics
const metrics = costOptimizer.getMetrics();
console.log(`Total cost: $${metrics.total_cost_usd.toFixed(4)}`);
console.log(`Budget used: ${(metrics.budget_used_pct * 100).toFixed(1)}%`);
```

**Provider Cost Table**:

| Provider | Model | Input ($/1M tokens) | Output ($/1M tokens) |
|---|---|---|---|
| OpenAI | gpt-4o | $2.50 | $10.00 |
| OpenAI | gpt-4o-mini | $0.15 | $0.60 |
| Gemini | gemini-1.5-pro | $1.25 | $5.00 |
| Gemini | gemini-1.5-flash | $0.075 | $0.30 |
| Claude | claude-3-5-sonnet | $3.00 | $15.00 |
| Claude | claude-3-haiku | $0.25 | $1.25 |

### 2. Quality Assurance

**Confidence Scoring** - Automatically calculate confidence scores for AI outputs.

```typescript
import { createQualityValidator } from '@/lib/graph/monitoring';

const validator = createQualityValidator(
  0.7,    // minConfidence
  false   // strictValidation
);

const assessment = validator.validate(
  result,        // EvaluationResult
  providersRaw,  // Record<string, EvaluationResult> (optional)
  consensus      // Consensus data (optional)
);

console.log(`Quality Level: ${assessment.quality_level}`);  // high | medium | low | critical
console.log(`Overall Confidence: ${assessment.confidence_score.overall}`);
console.log(`Requires Review: ${assessment.requires_human_review}`);
```

**Confidence Score Breakdown**:

- **Overall Confidence** (0-1): Weighted average of all sub-scores
- **Evidence Quality** (0-1): Based on quote precision and field paths
- **Consistency** (0-1): Cross-provider agreement
- **Completeness** (0-1): All required fields populated

**Quality Flags** - Automatic detection of quality issues:

```typescript
assessment.flags.forEach(flag => {
  console.log(`[${flag.severity}] ${flag.type}: ${flag.message}`);
  if (flag.suggestion) {
    console.log(`  → ${flag.suggestion}`);
  }
});
```

**Flag Types**:
- `missing_evidence` - Failed must-haves without evidence
- `low_confidence` - Overall confidence below threshold
- `inconsistent_scoring` - Providers disagree significantly
- `suspicious_pattern` - Unusual score patterns (e.g., 100 without justification)
- `incomplete_analysis` - Missing required fields

### 3. Cache Monitoring

**Track Cache Performance** - Monitor cache hit rates and cost savings.

```typescript
const cacheTracker = monitor.getCacheTracker();

// Record cache lookups
cacheTracker.recordLookup(true, 0.8, 0.015);  // hit, 0.8ms, saved $0.015
cacheTracker.recordLookup(false, 1.2);        // miss, 1.2ms

// Get metrics
const cacheMetrics = cacheTracker.getMetrics();
console.log(`Hit Rate: ${cacheMetrics.hit_rate_pct.toFixed(1)}%`);
console.log(`Cost Saved: $${cacheMetrics.cost_saved_usd.toFixed(4)}`);
```

### 4. Performance Monitoring

**Track Performance Metrics** - Monitor execution times and identify bottlenecks.

```typescript
// Record node executions
monitor.recordNodeExecution('extract', 15000);  // 15 seconds
monitor.recordNodeExecution('analyze', 8000);   // 8 seconds

// Record API calls
monitor.recordAPICall('openai', 7500);  // 7.5 seconds latency

// Get performance metrics
const report = monitor.generateReport(...);
console.log(`Total Duration: ${report.performance_metrics.total_duration_ms}ms`);
console.log(`Slowest Node: ${report.performance_metrics.slowest_node.node}`);
```

### 5. Comprehensive Monitoring Reports

**Generate Complete Reports** - Get all metrics in one place.

```typescript
const report = monitor.generateReport(
  executionId,
  finalResult,
  providersRaw,
  consensus
);

// Print formatted summary
monitor.printSummary(report);

// Or access individual sections
console.log(report.cost_metrics);
console.log(report.quality_assessment);
console.log(report.cache_metrics);
console.log(report.performance_metrics);
console.log(report.alerts);
```

## Configuration

### Full Configuration Example

```typescript
const config: MonitoringConfig = {
  cost_optimization: {
    enabled: true,
    budget: {
      max_cost_usd: 0.10,
      warn_threshold_pct: 0.80,
      mode: 'flexible',
    },
    strategy: {
      mode: 'balanced',
      preferred_providers: ['openai', 'gemini'],
      fallback_enabled: true,
    },
  },
  quality_assurance: {
    enabled: true,
    min_confidence: 0.65,
    strict_validation: false,
    auto_flag_low_quality: true,
  },
  performance: {
    enabled: true,
    max_duration_ms: 60000,
    alert_on_slow_node_ms: 10000,
  },
  alerts: {
    enabled: true,
    webhooks: ['https://alerts.example.com/webhook'],
  },
};

const monitor = createMonitoringManager(config);
```

### Configuration Options

**Cost Optimization**:
- `enabled`: Enable cost tracking
- `budget.max_cost_usd`: Maximum allowed cost
- `budget.warn_threshold_pct`: Warn at percentage (0-1)
- `budget.mode`: `'strict'` (fail) or `'flexible'` (warn only)
- `strategy.mode`: `'cost_optimized'` | `'quality_optimized'` | `'balanced'`
- `strategy.fallback_enabled`: Use fallback providers if primary fails

**Quality Assurance**:
- `enabled`: Enable quality validation
- `min_confidence`: Minimum confidence threshold (0-1)
- `strict_validation`: Fail if validation fails
- `auto_flag_low_quality`: Automatically flag low-quality outputs

**Performance**:
- `enabled`: Enable performance tracking
- `max_duration_ms`: Alert if execution exceeds this
- `alert_on_slow_node_ms`: Alert if node exceeds this

**Alerts**:
- `enabled`: Enable alert system
- `webhooks`: Array of webhook URLs for alerts

## Integration with CV Analysis

### Example: CV Analysis with Monitoring

```typescript
import { analyzeCVWithGraph } from '@/lib/cv-analysis';
import { createMonitoringManager } from '@/lib/graph/monitoring';

const monitor = createMonitoringManager({
  cost_optimization: {
    enabled: true,
    budget: { max_cost_usd: 0.05, warn_threshold_pct: 0.8, mode: 'flexible' },
  },
  quality_assurance: {
    enabled: true,
    min_confidence: 0.7,
  },
});

// Run CV analysis
const result = await analyzeCVWithGraph(cvText, jobSpec, {
  mode: 'balanced',
  projectId: 'project-123',
  candidateId: 'candidate-456',
});

// Generate monitoring report
const report = monitor.generateReport(
  'analysis-789',
  result.final_decision,
  result.providers_raw,
  result.consensus
);

// Check alerts
if (report.alerts.length > 0) {
  console.warn('Alerts detected:', report.alerts);
}

// Check if human review needed
if (report.quality_assessment.requires_human_review) {
  await flagForHumanReview(result, report.quality_assessment.flags);
}

// Print summary
monitor.printSummary(report);
```

## Alert Handling

### Alert Types and Severities

| Alert Type | Severity | Description |
|---|---|---|
| `budget_exceeded` | warning → critical | Budget threshold exceeded |
| `quality_issue` | warning → critical | Low quality detected |
| `performance_degradation` | warning | Slow execution or node |
| `error_rate_high` | error | High error rate detected |

### Alert Structure

```typescript
interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  type: 'budget_exceeded' | 'quality_issue' | 'performance_degradation' | 'error_rate_high';
  message: string;
  details: Record<string, any>;
  timestamp: string;
  resolved: boolean;
}
```

### Handling Alerts

```typescript
const report = monitor.generateReport(...);

for (const alert of report.alerts) {
  if (alert.severity === 'critical') {
    // Immediate action required
    await notifyOncall(alert);
    await pauseProcessing();
  } else if (alert.severity === 'warning') {
    // Log and monitor
    await logWarning(alert);
  }
}
```

## Best Practices

### 1. Always Set Budgets in Production

```typescript
// ✅ Good: Set reasonable budget
const config = {
  cost_optimization: {
    enabled: true,
    budget: { max_cost_usd: 0.50, warn_threshold_pct: 0.80, mode: 'strict' },
  },
};

// ❌ Bad: No budget limits
const config = {
  cost_optimization: { enabled: false },
};
```

### 2. Enable Quality Validation for Critical Decisions

```typescript
// ✅ Good: Validate before making hiring decisions
if (report.quality_assessment.requires_human_review) {
  await routeToHumanReviewer(result, report.quality_assessment);
}

// ❌ Bad: Blindly trust AI output
await autoRejectCandidate(result);
```

### 3. Monitor Cache Performance

```typescript
// ✅ Good: Track and optimize cache
const cacheMetrics = monitor.getCacheTracker().getMetrics();
if (cacheMetrics.hit_rate_pct < 30) {
  console.warn('Low cache hit rate - consider increasing TTL');
}
```

### 4. Use Cost-Optimized Mode for Bulk Processing

```typescript
// ✅ Good: Use cheapest models for bulk analysis
const monitor = createMonitoringManager({
  cost_optimization: {
    strategy: { mode: 'cost_optimized' },
  },
});

// Process 1000 CVs at minimal cost
```

### 5. Always Log and Store Monitoring Reports

```typescript
const report = monitor.generateReport(...);

// Store for analytics
await db.monitoringReports.create({
  execution_id: report.execution_id,
  report: JSON.stringify(report),
  timestamp: report.timestamp,
});

// Log for debugging
logger.info('Analysis complete', {
  cost: report.cost_metrics.total_cost_usd,
  quality: report.quality_assessment.quality_level,
});
```

## Demo

Run the Phase 4 demo to see all features in action:

```bash
npx tsx scripts/demo-phase4-monitoring.ts
```

The demo shows:
1. Budget-aware provider selection
2. Token tracking and cost alerts
3. Quality validation (good and poor results)
4. Cache performance tracking
5. Comprehensive monitoring reports

## Summary

Phase 4 provides:

- ✅ **Cost Control**: Budget limits, smart provider selection, token tracking
- ✅ **Quality Assurance**: Confidence scoring, evidence validation, quality flags
- ✅ **Cache Optimization**: Hit rate tracking, cost savings measurement
- ✅ **Performance Monitoring**: Execution times, bottleneck detection
- ✅ **Alerting**: Budget, quality, and performance alerts

All features are configurable and can be enabled/disabled independently.

## Next Steps

For further optimization, consider Phase 4 - Part B:
- Dynamic graph construction
- Workflow versioning
- A/B testing frameworks
- Advanced multi-agent collaboration

See `GRAPH_SYSTEM_GUIDE.md` for more information.
