/**
 * Phase 4 Demo: Cost Optimization + Quality Assurance
 *
 * Demonstrates:
 * 1. Budget-aware provider selection
 * 2. Token usage monitoring and alerts
 * 3. Quality validation with confidence scoring
 * 4. Cache hit rate tracking
 * 5. Performance metrics
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  createMonitoringManager,
  type CostBudget,
  type MonitoringConfig,
} from '@/lib/graph/monitoring';
import type { EvaluationResult } from '@/lib/cv-analysis/types';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Mock evaluation results for demonstration
const mockGoodResult: EvaluationResult = {
  recommendation: 'SHORTLIST',
  overall_score_0_to_100: 85,
  subscores: {
    experience_years_relevant: 4.5,
    skills_match_0_to_100: 80,
    nice_to_have_0_to_100: 70,
  },
  relevance_summary: {
    months_direct: 48,
    months_adjacent: 12,
    by_experience: [
      {
        index: 0,
        titre: 'Senior Developer',
        employeur: 'Tech Corp',
        start: '2020-01',
        end: '2024-01',
        relevance: 'DIRECTE',
        reason: 'Same role and technologies',
        evidence: [
          { quote: 'Led development of React applications for 4 years', field_path: 'experiences[0].missions[0]' },
        ],
      },
    ],
  },
  strengths: [
    'Strong technical background in required technologies',
    'Proven track record with similar projects',
    'Excellent communication skills mentioned',
  ],
  improvements: [
    'Could benefit from more experience in cloud architectures',
  ],
  fails: [],
  timestamp: new Date().toISOString(),
};

const mockPoorResult: EvaluationResult = {
  recommendation: 'REJECT',
  overall_score_0_to_100: 25,
  subscores: {
    experience_years_relevant: 0.5,
    skills_match_0_to_100: 20,
    nice_to_have_0_to_100: 10,
  },
  relevance_summary: {
    months_direct: 6,
    months_adjacent: 0,
    by_experience: [],
  },
  strengths: [],
  improvements: [
    'Lacks required experience',
    'Missing key technical skills',
  ],
  fails: [
    {
      must_have_id: 'MH-001',
      reason: 'Less than 2 years of required experience',
      evidence: [],  // Missing evidence - will trigger quality flag
    },
  ],
  timestamp: new Date().toISOString(),
};

async function demonstratePhase4() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚀 PHASE 4 DEMO: COST OPTIMIZATION + QUALITY ASSURANCE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // =========================================================================
  // DEMO 1: Cost Optimization with Budget Constraints
  // =========================================================================
  console.log('💰 DEMO 1: Cost Optimization with Budget');
  console.log('───────────────────────────────────────────────────────────────\n');

  const budget: CostBudget = {
    max_cost_usd: 0.05,  // $0.05 budget
    warn_threshold_pct: 0.8,  // Warn at 80%
    mode: 'flexible',  // Warn but don't fail
  };

  const config1: Partial<MonitoringConfig> = {
    cost_optimization: {
      enabled: true,
      budget,
      strategy: {
        mode: 'cost_optimized',
        fallback_enabled: true,
      },
    },
    quality_assurance: {
      enabled: false,  // Focus on cost for this demo
    },
  };

  const monitor1 = createMonitoringManager(config1);
  const costOptimizer = monitor1.getCostOptimizer();

  // Simulate provider selections
  console.log('Provider Selection (Cost-Optimized Strategy):');

  const extraction = costOptimizer.selectProvider('balanced', 'extract');
  console.log(`  1. Extraction: ${extraction.provider}/${extraction.model}`);
  console.log(`     Reason: ${extraction.reason}`);

  const analysis = costOptimizer.selectProvider('balanced', 'analyze', 0.04);
  console.log(`  2. Analysis: ${analysis.provider}/${analysis.model}`);
  console.log(`     Reason: ${analysis.reason}`);

  // Simulate token usage
  console.log('\nSimulating Token Usage...');
  costOptimizer.trackTokenUsage('openai', 'gpt-4o-mini', 1000, 500, 'extract');
  console.log(`  ✓ Tracked extraction: 1000 input + 500 output tokens`);

  costOptimizer.trackTokenUsage('gemini', 'gemini-1.5-flash', 2000, 800, 'analyze');
  console.log(`  ✓ Tracked analysis: 2000 input + 800 output tokens`);

  // Check budget
  const alerts1 = costOptimizer.checkBudget();
  console.log(`\nBudget Status:`);
  const metrics1 = costOptimizer.getMetrics();
  console.log(`  Cost: $${metrics1.total_cost_usd.toFixed(4)} / $${budget.max_cost_usd}`);
  console.log(`  Used: ${(metrics1.budget_used_pct * 100).toFixed(1)}%`);
  console.log(`  Alerts: ${alerts1.length}`);

  if (alerts1.length > 0) {
    for (const alert of alerts1) {
      console.log(`    ${alert.severity === 'warning' ? '⚠️ ' : '🚨'} ${alert.message}`);
    }
  }

  // =========================================================================
  // DEMO 2: Quality Assurance with Good Result
  // =========================================================================
  console.log('\n\n✅ DEMO 2: Quality Assurance - High Quality Result');
  console.log('───────────────────────────────────────────────────────────────\n');

  const config2: Partial<MonitoringConfig> = {
    cost_optimization: {
      enabled: false,
    },
    quality_assurance: {
      enabled: true,
      min_confidence: 0.7,
      strict_validation: false,
      auto_flag_low_quality: true,
    },
  };

  const monitor2 = createMonitoringManager(config2);
  const qualityValidator = monitor2.getQualityValidator();

  const goodAssessment = qualityValidator.validate(mockGoodResult);

  console.log('Quality Assessment:');
  console.log(`  Level: ${goodAssessment.quality_level.toUpperCase()}`);
  console.log(`  Overall Confidence: ${(goodAssessment.confidence_score.overall * 100).toFixed(1)}%`);
  console.log(`  Evidence Quality: ${(goodAssessment.confidence_score.evidence_quality * 100).toFixed(1)}%`);
  console.log(`  Consistency: ${(goodAssessment.confidence_score.consistency * 100).toFixed(1)}%`);
  console.log(`  Completeness: ${(goodAssessment.confidence_score.completeness * 100).toFixed(1)}%`);
  console.log(`  Requires Review: ${goodAssessment.requires_human_review ? 'YES' : 'NO'}`);
  console.log(`  Quality Flags: ${goodAssessment.flags.length}`);

  if (goodAssessment.flags.length > 0) {
    console.log('\nQuality Flags:');
    for (const flag of goodAssessment.flags) {
      console.log(`  • [${flag.severity.toUpperCase()}] ${flag.message}`);
    }
  }

  // =========================================================================
  // DEMO 3: Quality Assurance with Poor Result
  // =========================================================================
  console.log('\n\n⚠️  DEMO 3: Quality Assurance - Low Quality Result');
  console.log('───────────────────────────────────────────────────────────────\n');

  const poorAssessment = qualityValidator.validate(mockPoorResult);

  console.log('Quality Assessment:');
  console.log(`  Level: ${poorAssessment.quality_level.toUpperCase()}`);
  console.log(`  Overall Confidence: ${(poorAssessment.confidence_score.overall * 100).toFixed(1)}%`);
  console.log(`  Evidence Quality: ${(poorAssessment.confidence_score.evidence_quality * 100).toFixed(1)}%`);
  console.log(`  Requires Review: ${poorAssessment.requires_human_review ? 'YES ⚠️' : 'NO'}`);
  console.log(`  Quality Flags: ${poorAssessment.flags.length}`);

  if (poorAssessment.flags.length > 0) {
    console.log('\nQuality Flags:');
    for (const flag of poorAssessment.flags) {
      const icon = flag.severity === 'high' ? '🔴' : flag.severity === 'medium' ? '🟡' : '🔵';
      console.log(`  ${icon} [${flag.severity.toUpperCase()}] ${flag.message}`);
      if (flag.suggestion) {
        console.log(`     → Suggestion: ${flag.suggestion}`);
      }
    }
  }

  if (poorAssessment.recommendations.length > 0) {
    console.log('\nRecommendations:');
    for (const rec of poorAssessment.recommendations) {
      console.log(`  💡 ${rec}`);
    }
  }

  // =========================================================================
  // DEMO 4: Cache Tracking
  // =========================================================================
  console.log('\n\n💾 DEMO 4: Cache Performance Tracking');
  console.log('───────────────────────────────────────────────────────────────\n');

  const config4: Partial<MonitoringConfig> = {
    cost_optimization: { enabled: false },
    quality_assurance: { enabled: false },
  };

  const monitor4 = createMonitoringManager(config4);
  const cacheTracker = monitor4.getCacheTracker();

  // Simulate cache operations
  console.log('Simulating Cache Operations...');
  cacheTracker.recordLookup(false, 1.2);  // Cache miss
  console.log('  1. Lookup: MISS (1.2ms) - Full analysis required');

  cacheTracker.recordLookup(true, 0.8, 0.015);  // Cache hit with savings
  console.log('  2. Lookup: HIT (0.8ms) - Saved $0.015');

  cacheTracker.recordLookup(true, 0.5, 0.015);  // Cache hit
  console.log('  3. Lookup: HIT (0.5ms) - Saved $0.015');

  cacheTracker.recordLookup(false, 1.1);  // Cache miss
  console.log('  4. Lookup: MISS (1.1ms) - Full analysis required');

  cacheTracker.updateCacheSize(2);

  const cacheMetrics = cacheTracker.getMetrics();
  console.log('\nCache Metrics:');
  console.log(`  Hit Rate: ${cacheMetrics.hit_rate_pct.toFixed(1)}%`);
  console.log(`  Hits: ${cacheMetrics.cache_hits}`);
  console.log(`  Misses: ${cacheMetrics.cache_misses}`);
  console.log(`  Avg Lookup Time: ${cacheMetrics.avg_cache_lookup_ms.toFixed(2)}ms`);
  console.log(`  Cost Saved: $${cacheMetrics.cost_saved_usd.toFixed(4)}`);
  console.log(`  Cache Size: ${cacheMetrics.cache_size_items} items`);

  // =========================================================================
  // DEMO 5: Comprehensive Monitoring Report
  // =========================================================================
  console.log('\n\n📊 DEMO 5: Comprehensive Monitoring Report');
  console.log('───────────────────────────────────────────────────────────────\n');

  const fullConfig: Partial<MonitoringConfig> = {
    cost_optimization: {
      enabled: true,
      budget: {
        max_cost_usd: 0.02,
        warn_threshold_pct: 0.7,
        mode: 'flexible',
      },
      strategy: {
        mode: 'balanced',
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
      max_duration_ms: 30000,
      alert_on_slow_node_ms: 5000,
    },
  };

  const fullMonitor = createMonitoringManager(fullConfig);

  // Simulate operations
  fullMonitor.getCostOptimizer().trackTokenUsage('openai', 'gpt-4o', 2500, 1200, 'analyze');
  fullMonitor.getCacheTracker().recordLookup(false, 1.5);
  fullMonitor.recordNodeExecution('extract', 15000);
  fullMonitor.recordNodeExecution('analyze', 8000);
  fullMonitor.recordAPICall('openai', 7500);

  // Generate comprehensive report
  const report = fullMonitor.generateReport(
    'demo-12345',
    mockGoodResult,
    { openai: mockGoodResult },
    { agreement_score: 1.0 }
  );

  // Print summary
  fullMonitor.printSummary(report);

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎉 PHASE 4 FEATURES DEMONSTRATED');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('✅ Demonstrated Features:');
  console.log('   1. ✓ Budget-aware provider selection');
  console.log('   2. ✓ Token usage tracking and cost monitoring');
  console.log('   3. ✓ Budget alerts (warning + critical)');
  console.log('   4. ✓ Quality validation with confidence scoring');
  console.log('   5. ✓ Evidence quality assessment');
  console.log('   6. ✓ Quality flags for human review');
  console.log('   7. ✓ Cache hit rate tracking');
  console.log('   8. ✓ Cost savings from caching');
  console.log('   9. ✓ Performance metrics');
  console.log('   10. ✓ Comprehensive monitoring reports');
  console.log('');
  console.log('🚀 Phase 4 - Part A: COMPLETE!');
  console.log('');
}

// Run demo
demonstratePhase4()
  .then(() => {
    console.log('✅ Demo completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Demo failed:');
    console.error(error);
    process.exit(1);
  });
