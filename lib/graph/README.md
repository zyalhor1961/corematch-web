

# Graph Orchestration System

**LangGraph-like workflow orchestration for Corematch**

---

## 🎯 Overview

The Graph Orchestration System provides a **modular, reusable, and debuggable** way to build complex workflows using a **directed graph** pattern.

### Key Features

- ✅ **Modular nodes** - Reusable building blocks
- ✅ **Conditional routing** - if/else logic in workflows
- ✅ **Automatic retries** - Configurable retry with backoff
- ✅ **Error recovery** - Graceful error handling
- ✅ **State management** - Shared state across nodes
- ✅ **Execution history** - Full audit trail
- ✅ **Timeout handling** - Per-node timeouts
- ✅ **Visualization** - ASCII graph visualization

---

## 📐 Architecture

```
Graph = Collection of Nodes + Edges

Node = Function that transforms State
Edge = Connection between Nodes (with optional condition)
State = Shared data object that flows through the graph
```

### Example Workflow

```
Upload → Classify → Extract → Validate → Store → RAG → Complete
         ↓                     ↓
         └─ If PDF ───────────┘
         └─ If Image → OCR ───┘
```

---

## 🚀 Quick Start

### 1. Define Nodes

```typescript
import { createNode } from '@/lib/graph';

const uploadNode = createNode(
  'upload',
  'Upload File',
  async (state, input) => {
    // Your logic here
    return {
      success: true,
      stateUpdates: { fileUploaded: true },
    };
  },
  {
    type: 'custom',
    retry: { maxAttempts: 3, delayMs: 1000 },
    timeout: 5000,
  }
);
```

### 2. Build Graph

```typescript
import { createGraph } from '@/lib/graph';

const graph = createGraph('my-workflow', 'My Workflow')
  .addNode(uploadNode)
  .addNode(extractNode)
  .addNode(storeNode)
  .setEntry('upload')
  .addEdge('upload', 'extract')
  .addEdge('extract', 'store')
  .addExit('store')
  .build();
```

### 3. Execute Graph

```typescript
import { executeGraph } from '@/lib/graph';

const result = await executeGraph(graph, {
  initialData: { file: myFile },
  verbose: true,
});

console.log(result.success); // true
console.log(result.output); // Final state data
```

---

## 📖 Core Concepts

### Node

A **node** is a function that:
- Takes the current `state` and `input` data
- Performs some operation (extract, validate, transform, etc.)
- Returns a `NodeResult` with success/failure and state updates

**Node signature:**

```typescript
type NodeFunction = (
  state: GraphState,
  input: any
) => Promise<NodeResult>;
```

**Node result:**

```typescript
interface NodeResult {
  success: boolean;
  data?: any;                    // Output data
  stateUpdates?: Record<string, any>;  // Merge into state.data
  metadataUpdates?: Record<string, any>; // Merge into state.metadata
  nextNode?: string;              // Override next node (for dynamic routing)
  error?: string;
}
```

### Edge

An **edge** connects two nodes and can have an optional condition:

```typescript
// Simple edge
.addEdge('nodeA', 'nodeB')

// Conditional edge
.addEdge('nodeA', 'nodeB', (state) => state.data.isPDF === true, 'is PDF')
```

### State

The **state** is shared across all nodes:

```typescript
interface GraphState {
  executionId: string;
  currentNode?: string;
  data: Record<string, any>;      // Mutable data (updated by nodes)
  metadata: Record<string, any>;  // Immutable context
  history: ExecutionStep[];       // Execution trace
  errors: GraphError[];           // Errors encountered
  status: 'running' | 'completed' | 'failed';
}
```

---

## 🔧 Advanced Features

### Conditional Routing

```typescript
const graph = createGraph('conditional-workflow', 'Conditional Workflow')
  .addNode(checkTypeNode)
  .addNode(processPDFNode)
  .addNode(processImageNode)
  .setEntry('checkType')

  // If isPDF = true → processPDF
  .addEdge('checkType', 'processPDF', (state) => state.data.isPDF === true)

  // If isPDF = false → processImage
  .addEdge('checkType', 'processImage', (state) => state.data.isPDF === false)

  .addExit('processPDF')
  .addExit('processImage')
  .build();
```

### Retry Logic

```typescript
const extractNode = createNode(
  'extract',
  'Extract Data',
  async (state, input) => {
    // May fail, will retry automatically
    return await unstableAPICall();
  },
  {
    retry: {
      maxAttempts: 3,
      delayMs: 1000,
      backoff: 'exponential', // 1s, 2s, 4s
    },
  }
);
```

### Timeouts

```typescript
const slowNode = createNode(
  'slow',
  'Slow Operation',
  async (state, input) => {
    // Will timeout after 10s
    await verySlowOperation();
  },
  {
    timeout: 10000, // 10s
  }
);
```

### Sequential Chains

```typescript
// Shortcut for A → B → C → D
.addSequence('nodeA', 'nodeB', 'nodeC', 'nodeD')

// Equivalent to:
.addEdge('nodeA', 'nodeB')
.addEdge('nodeB', 'nodeC')
.addEdge('nodeC', 'nodeD')
```

---

## 📊 Complete Example: DAF Document Processing

```typescript
import { createGraph, createNode, executeGraph } from '@/lib/graph';
import { AzureDIExtractor } from '@/lib/daf-docs/extraction';
import { ingestDocument as ingestRAG } from '@/lib/rag';

// Node 1: Classify
const classifyNode = createNode('classify', 'Classify Document', async (state, input) => {
  const classification = classifyDocument(input.fileName, input.fileType);
  return {
    success: true,
    stateUpdates: { classification },
  };
});

// Node 2: Extract
const extractNode = createNode('extract', 'Extract Data', async (state, input) => {
  const extractor = new AzureDIExtractor();
  const result = await extractor.extractDocument(input.fileBuffer, input.fileName);
  return {
    success: result.success,
    stateUpdates: {
      extractionResult: result,
      pdfText: result.raw_response?.content,
    },
  };
}, {
  retry: { maxAttempts: 2, delayMs: 1000 },
  timeout: 30000,
});

// Node 3: Generate RAG Embeddings
const ragNode = createNode('rag', 'Generate Embeddings', async (state, input) => {
  const ragResult = await ingestRAG(input.pdfText, {
    org_id: input.orgId,
    source_id: input.documentId,
    content_type: 'daf_document',
    source_table: 'daf_documents',
    source_metadata: { file_name: input.fileName },
  });
  return {
    success: true,
    stateUpdates: { ragResult },
  };
});

// Build Graph
const dafGraph = createGraph('daf-processing', 'DAF Document Processing')
  .addNode(classifyNode)
  .addNode(extractNode)
  .addNode(ragNode)
  .setEntry('classify')
  .addSequence('classify', 'extract', 'rag')
  .addExit('rag')
  .build();

// Execute
const result = await executeGraph(dafGraph, {
  initialData: {
    fileBuffer: myBuffer,
    fileName: 'invoice.pdf',
    fileType: 'application/pdf',
    orgId: '123',
  },
  verbose: true,
});
```

---

## 🐛 Debugging

### Visualization

```typescript
const builder = createGraph('my-graph', 'My Graph');
// ... add nodes ...
console.log(builder.visualize());
```

Output:

```
Graph: My Graph
Entry: upload
Exit: complete

Nodes:
  - upload: Upload File [custom]
  - extract: Extract Data [extract]
  - validate: Validate [validate]
  - complete: Complete [custom]

Edges:
  upload → extract
  extract → validate
  validate → complete
```

### Execution History

```typescript
const result = await executeGraph(graph, { verbose: true });

// Access execution history
for (const step of result.finalState.history) {
  console.log(`${step.node}: ${step.duration}ms`);
  if (step.error) {
    console.error(`  Error: ${step.error}`);
  }
}
```

### Callbacks

```typescript
const result = await executeGraph(graph, {
  onNodeComplete: (node, result) => {
    console.log(`✓ ${node} completed`);
  },
  onError: (error) => {
    console.error(`❌ Error in ${error.node}: ${error.message}`);
    // Send to monitoring service
  },
});
```

---

## 📈 Performance

**Typical overhead:** ~5-10ms per node (state management + logging)

**Recommended limits:**
- Max nodes per graph: 50
- Max execution time: 5 minutes (set via `maxExecutionTime`)
- Max iterations: 100 (prevents infinite loops)

---

## 🔄 Migration from Current Orchestrators

### Before (orchestrator.ts)

```typescript
// Adhoc sequential code
const result1 = await step1();
const result2 = await step2(result1);
const result3 = await step3(result2);
```

### After (graph pattern)

```typescript
const graph = createGraph('workflow', 'My Workflow')
  .addNode(step1Node)
  .addNode(step2Node)
  .addNode(step3Node)
  .setEntry('step1')
  .addSequence('step1', 'step2', 'step3')
  .addExit('step3')
  .build();

const result = await executeGraph(graph);
```

**Benefits:**
- ✅ Reusable nodes
- ✅ Automatic retry
- ✅ Better error handling
- ✅ Execution history
- ✅ Easy to test individual nodes
- ✅ Conditional routing
- ✅ Visualization

---

## 📚 API Reference

### `createGraph(id, name, description?)`

Creates a new graph builder.

### `createNode(id, name, execute, options?)`

Creates a node.

**Options:**
- `description?: string`
- `type?: 'extract' | 'validate' | 'enrich' | 'transform' | 'store' | 'custom'`
- `retry?: { maxAttempts, delayMs, backoff? }`
- `timeout?: number`

### `executeGraph(graph, options?)`

Executes a graph.

**Options:**
- `initialData?: Record<string, any>`
- `metadata?: Record<string, any>`
- `maxExecutionTime?: number`
- `verbose?: boolean`
- `onNodeComplete?: (node, result) => void`
- `onError?: (error) => void`

---

## 🚀 Roadmap

- [ ] Graph versioning
- [ ] Parallel node execution
- [ ] Subgraphs (nested workflows)
- [ ] Graph templates library
- [ ] Visual editor (UI)
- [ ] Webhook triggers (n8n integration)
- [ ] Metrics dashboard

---

**Developed by:** Corematch Team
**Version:** 1.0.0
**Status:** ✅ Production Ready
