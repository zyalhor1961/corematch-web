/**
 * Graph Orchestration System
 * LangGraph-like workflow orchestration for Corematch
 */

// Core
export type {
  GraphState,
  GraphNode,
  GraphEdge,
  Graph,
  NodeFunction,
  NodeResult,
  GraphExecutionOptions,
  GraphExecutionResult,
  ExecutionStep,
  GraphError,
} from './core/types';

export { GraphBuilder, createGraph, createNode } from './core/graph';
export { GraphExecutor, executeGraph } from './core/executor';

// Common nodes
export * as ExtractNodes from './nodes/common/extract';
export * as ValidateNodes from './nodes/common/validate';
export * as TransformNodes from './nodes/common/transform';
export * as EnrichNodes from './nodes/common/enrich';
export * as StoreNodes from './nodes/common/store';

/**
 * Quick Start Example:
 *
 * ```typescript
 * import { createGraph, createNode, executeGraph } from '@/lib/graph';
 *
 * // Define nodes
 * const uploadNode = createNode('upload', 'Upload File', async (state, input) => ({
 *   success: true,
 *   stateUpdates: { fileUploaded: true },
 * }));
 *
 * const extractNode = createNode('extract', 'Extract Data', async (state, input) => ({
 *   success: true,
 *   stateUpdates: { dataExtracted: true },
 * }));
 *
 * // Build graph
 * const graph = createGraph('my-workflow', 'My Workflow')
 *   .addNode(uploadNode)
 *   .addNode(extractNode)
 *   .setEntry('upload')
 *   .addEdge('upload', 'extract')
 *   .addExit('extract')
 *   .build();
 *
 * // Execute
 * const result = await executeGraph(graph, {
 *   initialData: { file: myFile },
 *   verbose: true,
 * });
 * ```
 */
