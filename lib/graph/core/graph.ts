/**
 * Graph Builder
 * Fluent API for building graphs
 */

import type { Graph, GraphNode, GraphEdge, GraphState, NodeBuilder } from './types';
import { v4 as uuidv4 } from 'uuid';

export class GraphBuilder implements NodeBuilder {
  private graph: Graph;

  constructor(id: string, name: string, description?: string) {
    this.graph = {
      id,
      name,
      description,
      nodes: new Map(),
      edges: [],
      entryNode: '',
      exitNodes: [],
    };
  }

  /**
   * Add a node to the graph
   */
  addNode<TInput = any, TOutput = any>(node: GraphNode<TInput, TOutput>): this {
    if (this.graph.nodes.has(node.id)) {
      throw new Error(`Node with ID "${node.id}" already exists`);
    }

    this.graph.nodes.set(node.id, node);
    return this;
  }

  /**
   * Add an edge (connection) between two nodes
   */
  addEdge(
    from: string,
    to: string,
    condition?: (state: GraphState) => boolean,
    label?: string
  ): this {
    if (!this.graph.nodes.has(from)) {
      throw new Error(`Source node "${from}" not found`);
    }
    if (!this.graph.nodes.has(to)) {
      throw new Error(`Target node "${to}" not found`);
    }

    this.graph.edges.push({
      from,
      to,
      condition,
      label,
    });

    return this;
  }

  /**
   * Set the entry node (starting point)
   */
  setEntry(nodeId: string): this {
    if (!this.graph.nodes.has(nodeId)) {
      throw new Error(`Entry node "${nodeId}" not found`);
    }

    this.graph.entryNode = nodeId;
    return this;
  }

  /**
   * Add an exit node (ending point)
   */
  addExit(nodeId: string): this {
    if (!this.graph.nodes.has(nodeId)) {
      throw new Error(`Exit node "${nodeId}" not found`);
    }

    if (!this.graph.exitNodes.includes(nodeId)) {
      this.graph.exitNodes.push(nodeId);
    }

    return this;
  }

  /**
   * Add a conditional route (if-else pattern)
   */
  addConditionalRoute(
    from: string,
    condition: (state: GraphState) => boolean,
    trueNode: string,
    falseNode: string
  ): this {
    this.addEdge(from, trueNode, condition, 'true');
    this.addEdge(from, falseNode, (state) => !condition(state), 'false');
    return this;
  }

  /**
   * Add sequential nodes (A → B → C)
   */
  addSequence(...nodeIds: string[]): this {
    for (let i = 0; i < nodeIds.length - 1; i++) {
      this.addEdge(nodeIds[i], nodeIds[i + 1]);
    }
    return this;
  }

  /**
   * Build and validate the graph
   */
  build(): Graph {
    this.validate();
    return this.graph;
  }

  /**
   * Validate graph structure
   */
  private validate(): void {
    // Check entry node
    if (!this.graph.entryNode) {
      throw new Error('Graph must have an entry node');
    }

    // Check exit nodes
    if (this.graph.exitNodes.length === 0) {
      throw new Error('Graph must have at least one exit node');
    }

    // Check for orphaned nodes (no incoming edges except entry)
    const nodesWithIncoming = new Set<string>();
    nodesWithIncoming.add(this.graph.entryNode);

    for (const edge of this.graph.edges) {
      nodesWithIncoming.add(edge.to);
    }

    for (const nodeId of this.graph.nodes.keys()) {
      if (!nodesWithIncoming.has(nodeId) && nodeId !== this.graph.entryNode) {
        console.warn(`[Graph] Warning: Node "${nodeId}" is orphaned (no incoming edges)`);
      }
    }

    // Check for cycles (simple check)
    // TODO: Implement proper cycle detection if needed

    console.log(`[Graph] ✓ Graph "${this.graph.name}" validated`);
    console.log(`[Graph]   Nodes: ${this.graph.nodes.size}`);
    console.log(`[Graph]   Edges: ${this.graph.edges.length}`);
  }

  /**
   * Get the graph (without building)
   */
  getGraph(): Graph {
    return this.graph;
  }

  /**
   * Visualize graph as ASCII
   */
  visualize(): string {
    const lines: string[] = [];
    lines.push(`\nGraph: ${this.graph.name}`);
    lines.push(`Entry: ${this.graph.entryNode}`);
    lines.push(`Exit: ${this.graph.exitNodes.join(', ')}`);
    lines.push('\nNodes:');

    for (const [id, node] of this.graph.nodes) {
      lines.push(`  - ${id}: ${node.name}${node.type ? ` [${node.type}]` : ''}`);
    }

    lines.push('\nEdges:');
    for (const edge of this.graph.edges) {
      const label = edge.label ? ` (${edge.label})` : '';
      const condition = edge.condition ? ' [conditional]' : '';
      lines.push(`  ${edge.from} → ${edge.to}${label}${condition}`);
    }

    return lines.join('\n');
  }
}

/**
 * Helper: Create a graph builder
 */
export function createGraph(id: string, name: string, description?: string): GraphBuilder {
  return new GraphBuilder(id, name, description);
}

/**
 * Helper: Create a simple node
 */
export function createNode<TInput = any, TOutput = any>(
  id: string,
  name: string,
  execute: GraphNode<TInput, TOutput>['execute'],
  options?: {
    description?: string;
    type?: GraphNode['type'];
    retry?: GraphNode['retry'];
    timeout?: number;
  }
): GraphNode<TInput, TOutput> {
  return {
    id,
    name,
    description: options?.description,
    execute,
    type: options?.type,
    retry: options?.retry,
    timeout: options?.timeout,
  };
}
