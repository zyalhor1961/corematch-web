/**
 * Compare Old vs New CV Orchestrators
 * Demonstrates the benefits of graph-based orchestration
 */

import { orchestrateAnalysis } from '@/lib/cv-analysis/orchestrator';
import { analyzeCVWithGraph } from '@/lib/graph/graphs/cv-analysis';
import type { JobSpec, AnalysisMode } from '@/lib/cv-analysis/types';

// Sample CV text (shortened for demo)
const sampleCVText = `
John Doe
Senior Full-Stack Developer

Experience:
- Senior Developer at Tech Corp (2020-2024)
  * Led team of 5 developers building React/Node.js applications
  * Implemented microservices architecture using Docker and Kubernetes
  * Technologies: React, TypeScript, Node.js, PostgreSQL, AWS

- Full-Stack Developer at StartupXYZ (2018-2020)
  * Built full-stack web applications using React and Express
  * Technologies: React, JavaScript, MongoDB, Node.js

Skills:
- Frontend: React (Expert), TypeScript (Advanced), Vue.js (Intermediate)
- Backend: Node.js (Expert), Python (Intermediate), Java (Basic)
- Cloud: AWS (Advanced), Docker (Advanced), Kubernetes (Intermediate)
- Databases: PostgreSQL (Advanced), MongoDB (Advanced), Redis (Intermediate)

Education:
- B.S. Computer Science, University of Tech (2014-2018)
`;

// Sample job spec
const sampleJobSpec: JobSpec = {
  title: 'Senior Full-Stack Developer',
  company: 'Corematch',
  location: 'Remote',
  department: 'Engineering',
  must_have: [
    {
      label: 'React experience',
      description: 'Strong experience with React and modern frontend development',
      min_years_required: 3,
      weight: 1.0,
    },
    {
      label: 'Node.js backend',
      description: 'Backend development with Node.js',
      min_years_required: 3,
      weight: 1.0,
    },
  ],
  nice_to_have: [
    {
      label: 'TypeScript',
      description: 'TypeScript for type-safe development',
      weight: 0.3,
    },
    {
      label: 'Cloud (AWS/GCP)',
      description: 'Cloud infrastructure experience',
      weight: 0.2,
    },
  ],
  thresholds: {
    consider_min: 60,
    shortlist_min: 75,
    years_full_score: 3,
  },
};

async function compareOrchestrators() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔬 ORCHESTRATOR COMPARISON: Old vs New (Graph-Based)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const mode: AnalysisMode = 'eco'; // Use eco mode for quick test
  const projectId = 'test-project-123';

  // =========================================================================
  // Test 1: Old Orchestrator (Adhoc Sequential)
  // =========================================================================

  console.log('📊 TEST 1: Old Orchestrator (Adhoc Sequential)');
  console.log('─────────────────────────────────────────────────────────────\n');

  const oldStart = Date.now();

  try {
    const oldResult = await orchestrateAnalysis(sampleCVText, sampleJobSpec, {
      mode,
      projectId,
      enablePrefilter: false,
      enablePacking: false,
      forceSingleProvider: true, // Force single provider for fair comparison
    });

    const oldDuration = Date.now() - oldStart;

    console.log('\n✅ Old Orchestrator Results:');
    console.log(`   Duration: ${oldDuration}ms`);
    console.log(`   Cost: $${oldResult.cost.total_usd.toFixed(4)}`);
    console.log(`   Score: ${oldResult.final_decision.overall_score_0_to_100.toFixed(1)}/100`);
    console.log(`   Recommendation: ${oldResult.final_decision.recommendation}`);
    console.log(`   Providers: ${oldResult.debug.providers_used.join(', ')}`);
    console.log(`   Method: ${oldResult.debug.aggregation_method}`);
  } catch (error) {
    console.error('❌ Old orchestrator failed:', error);
  }

  console.log('\n');

  // =========================================================================
  // Test 2: New Orchestrator (Graph-Based)
  // =========================================================================

  console.log('📊 TEST 2: New Orchestrator (Graph-Based)');
  console.log('─────────────────────────────────────────────────────────────\n');

  const newStart = Date.now();

  try {
    const newResult = await analyzeCVWithGraph(sampleCVText, sampleJobSpec, {
      mode,
      projectId,
      enablePrefilter: false,
      enablePacking: false,
      forceSingleProvider: true, // Force single provider for fair comparison
    });

    const newDuration = Date.now() - newStart;

    console.log('\n✅ New Orchestrator (Graph) Results:');
    console.log(`   Duration: ${newDuration}ms`);
    console.log(`   Cost: $${newResult.cost.total_usd.toFixed(4)}`);
    console.log(`   Score: ${newResult.final_decision.overall_score_0_to_100.toFixed(1)}/100`);
    console.log(`   Recommendation: ${newResult.final_decision.recommendation}`);
    console.log(`   Providers: ${newResult.debug.providers_used.join(', ')}`);
    console.log(`   Method: ${newResult.debug.aggregation_method}`);
    console.log(`   Engine: ${newResult.context_snapshot.engine}`);
  } catch (error) {
    console.error('❌ New orchestrator failed:', error);
  }

  console.log('\n');

  // =========================================================================
  // Comparison Summary
  // =========================================================================

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📈 COMPARISON SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('Benefits of Graph-Based Orchestration:\n');

  console.log('✅ Modularity');
  console.log('   - Each step is a reusable node');
  console.log('   - Easy to add/remove steps');
  console.log('   - Clear separation of concerns\n');

  console.log('✅ Debuggability');
  console.log('   - Execution history tracking');
  console.log('   - Per-node timing and metrics');
  console.log('   - Error tracking with stack traces\n');

  console.log('✅ Testability');
  console.log('   - Each node can be tested independently');
  console.log('   - Easy to mock individual steps');
  console.log('   - Reproducible workflows\n');

  console.log('✅ Conditional Routing');
  console.log('   - Dynamic workflow paths based on state');
  console.log('   - Early exits (cache hit, prefilter fail)');
  console.log('   - Mode-based routing (eco/balanced/premium)\n');

  console.log('✅ Error Recovery');
  console.log('   - Automatic retry with backoff');
  console.log('   - Timeout handling per node');
  console.log('   - Non-blocking failures (RAG, cache)\n');

  console.log('✅ Visualization');
  console.log('   - ASCII graph visualization');
  console.log('   - Easy to understand workflow');
  console.log('   - Documentation as code\n');

  console.log('✅ Future Extensibility');
  console.log('   - Easy to add new providers');
  console.log('   - Simple to modify routing logic');
  console.log('   - Ready for subgraphs (nested workflows)\n');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎯 RECOMMENDATION: Use analyzeCVWithGraph() for all new code');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// Run comparison
compareOrchestrators()
  .then(() => {
    console.log('✅ Comparison complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Comparison failed:', error);
    process.exit(1);
  });
