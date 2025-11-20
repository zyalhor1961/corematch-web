# Graph Orchestration System - Developer Guide

## Overview

The Graph Orchestration System is a flexible, LangGraph-inspired workflow engine for managing complex multi-step processes like CV analysis, document processing, and more.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Graph Orchestration                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐      │
│  │  Node A  │─────→│  Node B  │─────→│  Node C  │      │
│  └──────────┘      └──────────┘      └──────────┘      │
│       │                  │                  │            │
│       │                  │                  │            │
│       ▼                  ▼                  ▼            │
│  ┌─────────────────────────────────────────────┐        │
│  │         Shared Graph State                  │        │
│  │  - data: CV analysis, documents, etc.       │        │
│  │  - metadata: timing, costs, providers       │        │
│  │  - history: execution trace                  │        │
│  └─────────────────────────────────────────────┘        │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. **Nodes**

Nodes are autonomous units of work that transform state. Each node:
- Receives the current graph state
- Performs a specific operation
- Returns updates to merge into state
- Can succeed or fail gracefully

```typescript
export const extractCV: NodeFunction<Input, Output> = async (state, input) => {
  // Read from state
  const cvText = state.data.cvText as string;

  // Do work
  const cvJson = await extractCVData(cvText);

  // Return updates
  return {
    success: true,
    data: { cvJson },
    stateUpdates: { cvJson },  // Merged into state.data
    metadataUpdates: { extractionTime }  // Merged into state.metadata
  };
};
```

### 2. **Edges**

Edges connect nodes and determine flow:

```typescript
graph
  .addEdge('extract', 'validate')  // Unconditional edge
  .addEdge('validate', 'prefilter', (state) => {
    // Conditional edge
    return state.data.enablePrefilter && state.data.mode !== 'eco';
  });
```

### 3. **State**

The graph state is a shared data structure passed through all nodes:

```typescript
interface GraphState {
  executionId: string;           // Unique execution ID
  currentNode: string | undefined;
  data: Record<string, any>;     // Main data (CVs, analysis results, etc.)
  metadata: Record<string, any>; // Metadata (timing, costs, etc.)
  history: ExecutionStep[];      // Execution trace
  errors: GraphError[];          // Errors encountered
  status: 'running' | 'completed' | 'failed';
}
```

**Key principle**: Nodes read from `state.data` and write via `stateUpdates`.

## Configuration (No Hard-Coded Values)

### Prefilter Configuration

The prefilter uses **configurable thresholds** instead of hard-coded magic numbers:

```typescript
import { prefilterCV, DEFAULT_PREFILTER_CONFIG, type PrefilterConfig } from '@/lib/cv-analysis/prefilter';

// Use defaults
const result = await prefilterCV(cv, jobSpec);

// Or customize
const customConfig: PrefilterConfig = {
  min_keyword_match: 0.10,  // 10% instead of default 5%
  weak_experience_threshold: 12,  // 12 months instead of 6
  // ... other thresholds
};

const result = await prefilterCV(cv, jobSpec, customConfig);
```

### Logger Configuration

Control logging output via environment variable or programmatic configuration:

```typescript
import { createLogger, type LogLevel } from '@/lib/graph/utils/logger';

// Via environment
// LOG_LEVEL=silent npm run dev  (no logs)
// LOG_LEVEL=info npm run dev    (default - info and above)
// LOG_LEVEL=debug npm run dev   (debug and above)

// Programmatically
const logger = createLogger({
  level: 'verbose',    // silent | error | warn | info | debug | verbose
  prefix: '[CVAnalysis]',
  timestamp: true
});

logger.info('Starting analysis...');
logger.debug('Debug details:', { cvLength: 1000 });
logger.error('Extraction failed:', error);
```

## CV Analysis Graph Example

### Graph Definition

```typescript
import { Graph } from '@/lib/graph/core/graph';
import { extractCV, validateCV, analyzeCV } from '@/lib/graph/nodes/cv';

export function createCVAnalysisGraph(): Graph {
  const graph = new Graph('CV Analysis Workflow');

  // Add nodes
  graph
    .addNode('init', initializeValidators, { name: 'Initialize' })
    .addNode('extract', extractCV, { name: 'Extract CV' })
    .addNode('validate', validateCV, { name: 'Validate CV' })
    .addNode('analyze', analyzeCV, { name: 'Analyze CV' });

  // Define flow
  graph
    .addEdge('init', 'extract')
    .addEdge('extract', 'validate')
    .addEdge('validate', 'analyze');

  // Set entry and exit points
  graph.setEntryNode('init');
  graph.addExitNode('analyze');

  return graph.build();
}
```

### Execution

```typescript
import { GraphExecutor } from '@/lib/graph/core/executor';
import { createCVAnalysisGraph } from '@/lib/graph/graphs/cv-analysis';

const graph = createCVAnalysisGraph();
const executor = new GraphExecutor(graph);

const result = await executor.execute({
  initialData: {
    cvText: '...',
    jobSpec: {...},
    mode: 'balanced'
  },
  verbose: true  // Enable detailed logging
});

if (result.success) {
  console.log('Final decision:', result.finalState.data.finalDecision);
  console.log('Duration:', result.duration, 'ms');
  console.log('Nodes executed:', result.nodesExecuted);
}
```

## Node Development Best Practices

### 1. Always Read from State

❌ **Wrong**: Reading from input parameter
```typescript
const cvText = input.cvText;  // ❌ Undefined after first node!
```

✅ **Correct**: Reading from state
```typescript
const cvText = state.data.cvText as string;  // ✅ Available across all nodes
```

### 2. Use Type Guards

```typescript
if (!cvText || !jobSpec) {
  throw new Error('Required data missing from state');
}
```

### 3. Return Structured Results

```typescript
return {
  success: true,
  data: { result },           // Returned to caller
  stateUpdates: { result },   // Merged into state.data
  metadataUpdates: { time }   // Merged into state.metadata
};
```

### 4. Handle Errors Gracefully

```typescript
try {
  // Do work
  return { success: true, ... };
} catch (error) {
  // Fail gracefully - graph will stop
  return {
    success: false,
    error: error instanceof Error ? error.message : 'Unknown error'
  };
}
```

## Conditional Edges

Use conditional edges for dynamic routing:

```typescript
graph.addEdge(
  'prefilter',
  'reject',
  (state) => !state.data.prefilterPass,  // Condition
  { label: 'prefilter failed' }          // Optional label for debugging
);

graph.addEdge(
  'prefilter',
  'analyze',
  (state) => state.data.prefilterPass,
  { label: 'prefilter passed' }
);
```

## Error Handling

### Node-Level Errors

Return `{ success: false, error: string }` to stop gracefully:

```typescript
if (!apiKey) {
  return {
    success: false,
    error: 'API key not configured'
  };
}
```

### Graph-Level Errors

The executor catches unhandled exceptions:

```typescript
const result = await executor.execute({ ... });

if (!result.success) {
  console.error('Graph failed:', result.errors);
  // result.errors contains all errors with timestamps and stack traces
}
```

## Performance Monitoring

The graph automatically tracks:
- Node execution times
- Total graph duration
- Retry attempts
- Error locations

Access via `result.finalState.history`:

```typescript
result.finalState.history.forEach(step => {
  console.log(`${step.node}: ${step.duration}ms`);
  if (step.retries > 0) {
    console.log(`  └─ Retried ${step.retries} times`);
  }
});
```

## Testing Graphs

```typescript
import { createCVAnalysisGraph } from '@/lib/graph/graphs/cv-analysis';

describe('CV Analysis Graph', () => {
  it('should complete full analysis', async () => {
    const graph = createCVAnalysisGraph();
    const executor = new GraphExecutor(graph);

    const result = await executor.execute({
      initialData: {
        cvText: testCV,
        jobSpec: testJobSpec,
        mode: 'eco'
      }
    });

    expect(result.success).toBe(true);
    expect(result.finalState.data.finalDecision).toBeDefined();
    expect(result.finalState.data.finalDecision.recommendation).toMatch(/REJECT|CONSIDER|SHORTLIST/);
  });

  it('should handle missing API keys gracefully', async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await executor.execute({ ... });

    expect(result.success).toBe(false);
    expect(result.errors[0].message).toContain('API key');
  });
});
```

## Extending the System

### Adding a New Node

1. **Define the node function**:

```typescript
export const myNewNode: NodeFunction<Input, Output> = async (state, input) => {
  // Read from state
  const data = state.data.someData as SomeType;

  // Process
  const result = await doSomething(data);

  // Return updates
  return {
    success: true,
    data: { result },
    stateUpdates: { processedData: result }
  };
};
```

2. **Add to graph**:

```typescript
graph
  .addNode('myNode', myNewNode, { name: 'My New Node' })
  .addEdge('previousNode', 'myNode')
  .addEdge('myNode', 'nextNode');
```

### Creating a New Graph

1. Create a new file in `lib/graph/graphs/my-workflow.ts`
2. Define your nodes in `lib/graph/nodes/my-domain/`
3. Build the graph with edges
4. Export a factory function

```typescript
export function createMyWorkflowGraph(): Graph {
  const graph = new Graph('My Workflow');
  // ... add nodes and edges
  return graph.build();
}
```

## Environment Variables

Configure the system via environment variables:

```bash
# Logging
LOG_LEVEL=info              # silent | error | warn | info | debug | verbose

# API Keys (read via 1Password or .env.local)
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...

# Graph behavior
GRAPH_VERBOSE=true          # Enable detailed execution logging
GRAPH_RETRY_ENABLED=true    # Enable automatic retries
```

## Migration from Legacy Code

### Before (Hard-Coded Orchestration)

```typescript
const cv = await extractCV(text);
const validated = validateCV(cv);
if (!validated) throw new Error('Invalid');
const analysis = await analyzeCV(cv, jobSpec);
return analysis;
```

### After (Graph Orchestration)

```typescript
const graph = createCVAnalysisGraph();
const executor = new GraphExecutor(graph);

const result = await executor.execute({
  initialData: { cvText: text, jobSpec }
});

return result.finalState.data.finalDecision;
```

**Benefits**:
- ✅ Automatic error handling
- ✅ Execution tracing
- ✅ Retry logic
- ✅ Conditional routing
- ✅ Performance monitoring
- ✅ Testable units

## Troubleshooting

### Graph Stops After N Nodes

**Problem**: Graph completes early without reaching exit node.

**Solution**: Check that nodes are reading from `state.data`, not `input`:

```typescript
// ❌ Wrong
const cvJson = input.cvJson;

// ✅ Correct
const cvJson = state.data.cvJson as CV_JSON;
```

### No Next Node Found

**Problem**: `⚠ No next node found after X, stopping`

**Solution**: Add an edge from node X to the next node:

```typescript
graph.addEdge('X', 'Y');
```

### State Data Missing

**Problem**: `Required data not found in state`

**Solution**: Ensure previous node sets the data via `stateUpdates`:

```typescript
return {
  success: true,
  data: { myData },
  stateUpdates: { myData }  // ← This is required!
};
```

## Additional Resources

- **Core Types**: `lib/graph/core/types.ts`
- **Graph Builder**: `lib/graph/core/graph.ts`
- **Executor**: `lib/graph/core/executor.ts`
- **CV Nodes**: `lib/graph/nodes/cv/index.ts`
- **Examples**: `scripts/test-graph-*.ts`

## Summary

The Graph Orchestration System provides:

1. **Flexibility**: Easy to add/remove/reorder nodes
2. **Configuration**: No hard-coded values, everything is configurable
3. **Observability**: Automatic logging, tracing, and monitoring
4. **Reliability**: Built-in error handling and retry logic
5. **Testability**: Each node is independently testable
6. **Maintainability**: Clear separation of concerns

Start with the CV Analysis example and adapt it to your use case!
