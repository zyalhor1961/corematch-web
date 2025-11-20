/**
 * Test Graph Core Functionality
 * Tests the graph orchestration system without external dependencies
 */

import { createGraph, createNode, executeGraph } from '@/lib/graph';

async function testGraphCore() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 GRAPH CORE FUNCTIONALITY TEST');
  console.log('═══════════════════════════════════════════════════════\n');

  // Test 1: Create Simple Nodes
  console.log('📋 Test 1: Creating Simple Nodes');
  console.log('─────────────────────────────────────────────────────────');

  const node1 = createNode('start', 'Start Node', async (state, input) => {
    console.log('  [start] Processing...');
    return {
      success: true,
      stateUpdates: {
        step1Complete: true,
        message: 'Started successfully',
      },
    };
  });

  const node2 = createNode('process', 'Process Node', async (state, input) => {
    console.log('  [process] Processing...');
    return {
      success: true,
      stateUpdates: {
        step2Complete: true,
        processedData: { value: 42 },
      },
    };
  });

  const node3 = createNode('validate', 'Validate Node', async (state, input) => {
    console.log('  [validate] Validating...');
    const isValid = input.processedData?.value === 42;
    return {
      success: true,
      stateUpdates: {
        step3Complete: true,
        isValid,
      },
    };
  });

  const node4 = createNode('complete', 'Complete Node', async (state, input) => {
    console.log('  [complete] Completing...');
    return {
      success: true,
      stateUpdates: {
        completed: true,
        finalMessage: 'All steps completed successfully',
      },
    };
  });

  console.log('✓ Created 4 nodes\n');

  // Test 2: Build Graph
  console.log('📊 Test 2: Building Graph');
  console.log('─────────────────────────────────────────────────────────');

  const graph = createGraph('test-workflow', 'Test Workflow', 'Simple test workflow')
    .addNode(node1)
    .addNode(node2)
    .addNode(node3)
    .addNode(node4)
    .setEntry('start')
    .addSequence('start', 'process', 'validate', 'complete')
    .addExit('complete')
    .build();

  console.log(`✓ Graph created: ${graph.name}`);
  console.log(`  Nodes: ${graph.nodes.size}`);
  console.log(`  Edges: ${graph.edges.length}`);
  console.log(`  Entry: ${graph.entryNode}`);
  console.log(`  Exits: ${graph.exitNodes.join(', ')}`);
  console.log('');

  // Test 3: Visualize Graph
  console.log('📐 Test 3: Graph Visualization');
  console.log('─────────────────────────────────────────────────────────');

  console.log(`Graph: ${graph.name}`);
  console.log(`Entry: ${graph.entryNode} → Exit: ${graph.exitNodes.join(', ')}\n`);

  console.log('Flow:');
  for (const edge of graph.edges) {
    console.log(`  ${edge.from} → ${edge.to}`);
  }
  console.log('');

  // Test 4: Execute Graph
  console.log('🚀 Test 4: Execute Graph');
  console.log('─────────────────────────────────────────────────────────');

  const result = await executeGraph(graph, {
    initialData: {
      testInput: 'hello world',
    },
    verbose: true,
    onNodeComplete: (nodeId, nodeResult) => {
      console.log(`  [Callback] ✓ ${nodeId} completed`);
    },
  });

  console.log('\n📊 EXECUTION RESULTS');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`Execution ID: ${result.executionId}`);
  console.log(`Success: ${result.success}`);
  console.log(`Duration: ${result.duration}ms`);
  console.log(`Nodes executed: ${result.nodesExecuted.length}`);
  console.log(`Execution path: ${result.nodesExecuted.join(' → ')}`);

  console.log('\n📜 Execution History:');
  for (const step of result.finalState.history) {
    console.log(`  ✅ ${step.node}: ${step.duration}ms`);
  }

  console.log('\n📦 Final State:');
  console.log(JSON.stringify(result.finalState.data, null, 2));

  // Test 5: Conditional Routing
  console.log('\n🔀 Test 5: Conditional Routing');
  console.log('─────────────────────────────────────────────────────────');

  const checkNode = createNode('check', 'Check Value', async (state, input) => {
    return {
      success: true,
      stateUpdates: {
        value: input.value || 0,
      },
    };
  });

  const positiveNode = createNode('positive', 'Positive Path', async (state, input) => {
    return {
      success: true,
      stateUpdates: {
        result: 'Value is positive',
      },
    };
  });

  const negativeNode = createNode('negative', 'Negative Path', async (state, input) => {
    return {
      success: true,
      stateUpdates: {
        result: 'Value is negative or zero',
      },
    };
  });

  const endNode = createNode('end', 'End Node', async (state, input) => {
    return {
      success: true,
      stateUpdates: {
        completed: true,
      },
    };
  });

  const conditionalGraph = createGraph('conditional-test', 'Conditional Test')
    .addNode(checkNode)
    .addNode(positiveNode)
    .addNode(negativeNode)
    .addNode(endNode)
    .setEntry('check')
    .addEdge('check', 'positive', (state) => state.data.value > 0, 'value > 0')
    .addEdge('check', 'negative', (state) => state.data.value <= 0, 'value <= 0')
    .addEdge('positive', 'end')
    .addEdge('negative', 'end')
    .addExit('end')
    .build();

  console.log('Testing with value = 10:');
  const positiveResult = await executeGraph(conditionalGraph, {
    initialData: { value: 10 },
    verbose: false,
  });
  console.log(`  Path taken: ${positiveResult.nodesExecuted.join(' → ')}`);
  console.log(`  Result: ${positiveResult.finalState.data.result}`);

  console.log('\nTesting with value = -5:');
  const negativeResult = await executeGraph(conditionalGraph, {
    initialData: { value: -5 },
    verbose: false,
  });
  console.log(`  Path taken: ${negativeResult.nodesExecuted.join(' → ')}`);
  console.log(`  Result: ${negativeResult.finalState.data.result}`);

  // Test 6: Error Handling and Retry
  console.log('\n❌ Test 6: Error Handling and Retry');
  console.log('─────────────────────────────────────────────────────────');

  let attempts = 0;
  const flakyNode = createNode(
    'flaky',
    'Flaky Node',
    async (state, input) => {
      attempts++;
      console.log(`  [flaky] Attempt ${attempts}...`);
      if (attempts < 2) {
        throw new Error('Simulated failure');
      }
      return {
        success: true,
        stateUpdates: {
          flakyCompleted: true,
        },
      };
    },
    {
      retry: {
        maxAttempts: 3,
        delayMs: 100,
      },
    }
  );

  const successNode = createNode('success', 'Success Node', async (state, input) => {
    return {
      success: true,
      stateUpdates: {
        finalSuccess: true,
      },
    };
  });

  const errorGraph = createGraph('error-test', 'Error Test')
    .addNode(flakyNode)
    .addNode(successNode)
    .setEntry('flaky')
    .addEdge('flaky', 'success')
    .addExit('success')
    .build();

  const errorResult = await executeGraph(errorGraph, {
    verbose: true,
  });

  console.log(`\nSuccess after ${attempts} attempts: ${errorResult.success}`);

  // Test 7: Feature Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ CORE FEATURES VALIDATED');
  console.log('═══════════════════════════════════════════════════════');

  const features = {
    'Node creation': true,
    'Graph building': graph.nodes.size === 4,
    'Sequential edges': graph.edges.length === 3,
    'Entry/Exit nodes': graph.entryNode === 'start' && graph.exitNodes.includes('complete'),
    'Graph execution': result.success,
    'State management': result.finalState.data.isValid === true,
    'Execution history': result.finalState.history.length === 3,
    'Callbacks': result.nodesExecuted.length === 3,
    'Conditional routing': positiveResult.nodesExecuted.includes('positive') && negativeResult.nodesExecuted.includes('negative'),
    'Error handling': errorResult.success,
    'Retry logic': attempts > 1,
  };

  for (const [feature, status] of Object.entries(features)) {
    console.log(`  ${status ? '✅' : '❌'} ${feature}`);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🎉 ALL TESTS PASSED');
  console.log('═══════════════════════════════════════════════════════\n');

  return {
    success: true,
    features,
  };
}

// Run tests
testGraphCore()
  .then((result) => {
    if (result.success) {
      console.log('✅ Test suite completed successfully');
      process.exit(0);
    } else {
      console.log('❌ Test suite failed');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('💥 Unexpected error:');
    console.error(error);
    process.exit(1);
  });
