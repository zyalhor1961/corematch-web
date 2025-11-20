/**
 * Graph Orchestration - Core Types
 * Type definitions for graph-based workflow orchestration
 */

/**
 * Graph State - Shared state that flows through the graph
 */
export interface GraphState {
  /**
   * Unique execution ID
   */
  executionId: string;

  /**
   * Current node being executed
   */
  currentNode?: string;

  /**
   * Data payload (mutable, passed between nodes)
   */
  data: Record<string, any>;

  /**
   * Metadata (immutable context)
   */
  metadata: {
    startedAt: string;
    userId?: string;
    orgId?: string;
    [key: string]: any;
  };

  /**
   * Execution history (for debugging)
   */
  history: ExecutionStep[];

  /**
   * Errors encountered
   */
  errors: GraphError[];

  /**
   * Current status
   */
  status: 'running' | 'completed' | 'failed' | 'paused';
}

/**
 * Execution step in history
 */
export interface ExecutionStep {
  node: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  input: any;
  output?: any;
  error?: string;
  retries?: number;
}

/**
 * Graph error
 */
export interface GraphError {
  node: string;
  message: string;
  timestamp: string;
  recoverable: boolean;
  stack?: string;
}

/**
 * Node function signature
 */
export type NodeFunction<TInput = any, TOutput = any> = (
  state: GraphState,
  input: TInput
) => Promise<NodeResult<TOutput>>;

/**
 * Node result
 */
export interface NodeResult<T = any> {
  /**
   * Success flag
   */
  success: boolean;

  /**
   * Output data
   */
  data?: T;

  /**
   * Error if failed
   */
  error?: string;

  /**
   * Next node to execute (for conditional routing)
   */
  nextNode?: string;

  /**
   * State updates (merged into state.data)
   */
  stateUpdates?: Record<string, any>;

  /**
   * Metadata updates
   */
  metadataUpdates?: Record<string, any>;
}

/**
 * Node definition
 */
export interface GraphNode<TInput = any, TOutput = any> {
  /**
   * Unique node ID
   */
  id: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Node description
   */
  description?: string;

  /**
   * Node function
   */
  execute: NodeFunction<TInput, TOutput>;

  /**
   * Retry configuration
   */
  retry?: {
    maxAttempts: number;
    delayMs: number;
    backoff?: 'linear' | 'exponential';
  };

  /**
   * Timeout (ms)
   */
  timeout?: number;

  /**
   * Node type (for categorization)
   */
  type?: 'extract' | 'validate' | 'enrich' | 'transform' | 'store' | 'custom';
}

/**
 * Edge definition (connection between nodes)
 */
export interface GraphEdge {
  /**
   * Source node ID
   */
  from: string;

  /**
   * Target node ID
   */
  to: string;

  /**
   * Condition for this edge (optional)
   */
  condition?: (state: GraphState) => boolean;

  /**
   * Edge label (for visualization)
   */
  label?: string;
}

/**
 * Graph definition
 */
export interface Graph {
  /**
   * Graph ID
   */
  id: string;

  /**
   * Graph name
   */
  name: string;

  /**
   * Graph description
   */
  description?: string;

  /**
   * All nodes in the graph
   */
  nodes: Map<string, GraphNode>;

  /**
   * All edges (connections)
   */
  edges: GraphEdge[];

  /**
   * Entry node ID
   */
  entryNode: string;

  /**
   * Exit node IDs
   */
  exitNodes: string[];

  /**
   * Graph metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Graph execution options
 */
export interface GraphExecutionOptions {
  /**
   * Initial state data
   */
  initialData?: Record<string, any>;

  /**
   * Metadata
   */
  metadata?: Record<string, any>;

  /**
   * Maximum execution time (ms)
   */
  maxExecutionTime?: number;

  /**
   * Enable detailed logging
   */
  verbose?: boolean;

  /**
   * Callback on node completion
   */
  onNodeComplete?: (node: string, result: NodeResult) => void;

  /**
   * Callback on error
   */
  onError?: (error: GraphError) => void;
}

/**
 * Graph execution result
 */
export interface GraphExecutionResult {
  /**
   * Execution ID
   */
  executionId: string;

  /**
   * Success flag
   */
  success: boolean;

  /**
   * Final state
   */
  finalState: GraphState;

  /**
   * Execution duration (ms)
   */
  duration: number;

  /**
   * Nodes executed (in order)
   */
  nodesExecuted: string[];

  /**
   * Errors encountered
   */
  errors: GraphError[];

  /**
   * Final output data
   */
  output?: any;
}

/**
 * Conditional router function
 */
export type RouterFunction = (state: GraphState) => string;

/**
 * Graph builder helper types
 */
export interface NodeBuilder {
  addNode<TInput = any, TOutput = any>(node: GraphNode<TInput, TOutput>): NodeBuilder;
  addEdge(from: string, to: string, condition?: (state: GraphState) => boolean): NodeBuilder;
  setEntry(nodeId: string): NodeBuilder;
  addExit(nodeId: string): NodeBuilder;
  build(): Graph;
}
