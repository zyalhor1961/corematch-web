/**
 * Graph Executor
 * Executes graph workflows with retry, error handling, and monitoring
 */

import type {
  Graph,
  GraphState,
  GraphExecutionOptions,
  GraphExecutionResult,
  GraphError,
  ExecutionStep,
  NodeResult,
} from './types';
import { v4 as uuidv4 } from 'uuid';

export class GraphExecutor {
  private graph: Graph;
  private verbose: boolean = false;

  constructor(graph: Graph) {
    this.graph = graph;
  }

  /**
   * Execute the graph
   */
  async execute(options: GraphExecutionOptions = {}): Promise<GraphExecutionResult> {
    const startTime = Date.now();
    this.verbose = options.verbose || false;

    // Initialize state
    const state: GraphState = {
      executionId: uuidv4(),
      currentNode: undefined,
      data: options.initialData || {},
      metadata: {
        startedAt: new Date().toISOString(),
        ...options.metadata,
      },
      history: [],
      errors: [],
      status: 'running',
    };

    this.log(`\n════════════════════════════════════════════════`);
    this.log(`🎬 GRAPH EXECUTION: ${this.graph.name}`);
    this.log(`   Execution ID: ${state.executionId}`);
    this.log(`   Entry node: ${this.graph.entryNode}`);
    this.log(`════════════════════════════════════════════════\n`);

    const nodesExecuted: string[] = [];
    let currentNodeId = this.graph.entryNode;
    let iterations = 0;
    const maxIterations = 100; // Prevent infinite loops

    try {
      // Execute nodes until we reach an exit node
      while (currentNodeId && iterations < maxIterations) {
        iterations++;

        // Check if we've reached an exit node
        if (this.graph.exitNodes.includes(currentNodeId)) {
          this.log(`✓ Reached exit node: ${currentNodeId}\n`);
          break;
        }

        // Execute current node
        const result = await this.executeNode(state, currentNodeId, options);
        nodesExecuted.push(currentNodeId);

        if (!result.success) {
          // Node failed
          state.status = 'failed';
          break;
        }

        // Determine next node
        const nextNode = await this.determineNextNode(state, currentNodeId, result);

        if (!nextNode) {
          this.log(`⚠ No next node found after ${currentNodeId}, stopping\n`);
          break;
        }

        currentNodeId = nextNode;
      }

      if (iterations >= maxIterations) {
        throw new Error('Graph execution exceeded maximum iterations (possible infinite loop)');
      }

      // Determine final status
      if (state.status === 'running') {
        state.status = 'completed';
      }

      const duration = Date.now() - startTime;

      this.log(`════════════════════════════════════════════════`);
      this.log(`✅ GRAPH EXECUTION: ${state.status.toUpperCase()}`);
      this.log(`   Duration: ${duration}ms`);
      this.log(`   Nodes executed: ${nodesExecuted.length}`);
      this.log(`   Errors: ${state.errors.length}`);
      this.log(`════════════════════════════════════════════════\n`);

      return {
        executionId: state.executionId,
        success: state.status === 'completed',
        finalState: state,
        duration,
        nodesExecuted,
        errors: state.errors,
        output: state.data,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.log(`════════════════════════════════════════════════`);
      this.log(`❌ GRAPH EXECUTION: FAILED`);
      this.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.log(`   Duration: ${duration}ms`);
      this.log(`════════════════════════════════════════════════\n`);

      state.status = 'failed';
      state.errors.push({
        node: currentNodeId || 'executor',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        recoverable: false,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        executionId: state.executionId,
        success: false,
        finalState: state,
        duration,
        nodesExecuted,
        errors: state.errors,
      };
    }
  }

  /**
   * Execute a single node with retry logic
   */
  private async executeNode(
    state: GraphState,
    nodeId: string,
    options: GraphExecutionOptions
  ): Promise<NodeResult> {
    const node = this.graph.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node "${nodeId}" not found in graph`);
    }

    state.currentNode = nodeId;

    this.log(`📍 Executing node: ${nodeId} (${node.name})`);

    const step: ExecutionStep = {
      node: nodeId,
      startedAt: new Date().toISOString(),
      input: { ...state.data },
      retries: 0,
    };

    const maxAttempts = node.retry?.maxAttempts || 1;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Execute with timeout if configured
        const result = node.timeout
          ? await this.executeWithTimeout(node.execute(state, state.data), node.timeout)
          : await node.execute(state, state.data);

        // Update step
        step.completedAt = new Date().toISOString();
        step.duration = new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime();
        step.output = result.data;

        // Update state with node result
        if (result.stateUpdates) {
          Object.assign(state.data, result.stateUpdates);
        }
        if (result.metadataUpdates) {
          Object.assign(state.metadata, result.metadataUpdates);
        }

        state.history.push(step);

        this.log(`   ✓ Completed in ${step.duration}ms${attempt > 1 ? ` (retry ${attempt - 1})` : ''}`);

        // Call callback
        if (options.onNodeComplete) {
          options.onNodeComplete(nodeId, result);
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        step.retries = attempt;

        this.log(`   ❌ Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`);

        // Retry with delay if configured
        if (attempt < maxAttempts && node.retry) {
          const delay = this.calculateRetryDelay(attempt, node.retry.delayMs, node.retry.backoff);
          this.log(`   ⏳ Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    step.completedAt = new Date().toISOString();
    step.duration = new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime();
    step.error = lastError?.message;

    state.history.push(step);

    const graphError: GraphError = {
      node: nodeId,
      message: lastError?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      recoverable: false,
      stack: lastError?.stack,
    };

    state.errors.push(graphError);

    // Call error callback
    if (options.onError) {
      options.onError(graphError);
    }

    return {
      success: false,
      error: lastError?.message,
    };
  }

  /**
   * Determine the next node based on edges and conditions
   */
  private async determineNextNode(
    state: GraphState,
    currentNodeId: string,
    result: NodeResult
  ): Promise<string | null> {
    // If node explicitly specified next node
    if (result.nextNode) {
      this.log(`   → Next: ${result.nextNode} (explicit)`);
      return result.nextNode;
    }

    // Find outgoing edges from current node
    const outgoingEdges = this.graph.edges.filter((e) => e.from === currentNodeId);

    if (outgoingEdges.length === 0) {
      return null;
    }

    // Evaluate conditional edges
    for (const edge of outgoingEdges) {
      if (edge.condition) {
        const conditionMet = edge.condition(state);
        if (conditionMet) {
          this.log(`   → Next: ${edge.to} (condition: ${edge.label || 'true'})`);
          return edge.to;
        }
      }
    }

    // If no conditional edge matched, take first unconditional edge
    const unconditionalEdge = outgoingEdges.find((e) => !e.condition);
    if (unconditionalEdge) {
      this.log(`   → Next: ${unconditionalEdge.to}`);
      return unconditionalEdge.to;
    }

    return null;
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Calculate retry delay with backoff
   */
  private calculateRetryDelay(
    attempt: number,
    baseDelay: number,
    backoff: 'linear' | 'exponential' = 'linear'
  ): number {
    if (backoff === 'exponential') {
      return baseDelay * Math.pow(2, attempt - 1);
    }
    return baseDelay * attempt;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log (only if verbose)
   */
  private log(message: string): void {
    if (this.verbose) {
      console.log(`[Graph] ${message}`);
    }
  }
}

/**
 * Helper: Execute a graph
 */
export async function executeGraph(
  graph: Graph,
  options?: GraphExecutionOptions
): Promise<GraphExecutionResult> {
  const executor = new GraphExecutor(graph);
  return executor.execute(options);
}
