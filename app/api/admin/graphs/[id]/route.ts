/**
 * Admin API: Individual Graph Operations
 *
 * GET /api/admin/graphs/[id] - Get graph details with nodes and edges
 * PATCH /api/admin/graphs/[id] - Update graph
 * DELETE /api/admin/graphs/[id] - Delete graph
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/auth-middleware';

/**
 * GET /api/admin/graphs/[id]
 * Get complete graph with nodes, edges, and active config
 */
export const GET = withAuth(async (request, session, context) => {
  try {
    const params = await context.params;
    const graphId = params.id;
    const supabase = await getSupabaseAdmin();

    // Fetch graph with all related data
    const { data: graph, error: graphError } = await supabase
      .from('graphs')
      .select('*')
      .eq('id', graphId)
      .single();

    if (graphError || !graph) {
      return NextResponse.json(
        { error: 'Graph not found', details: graphError?.message },
        { status: 404 }
      );
    }

    // Fetch nodes
    const { data: nodes, error: nodesError } = await supabase
      .from('graph_nodes')
      .select('*')
      .eq('graph_id', graphId)
      .order('created_at', { ascending: true });

    if (nodesError) {
      console.error('[graphs/[id]] Error fetching nodes:', nodesError);
    }

    // Fetch edges
    const { data: edges, error: edgesError } = await supabase
      .from('graph_edges')
      .select('*')
      .eq('graph_id', graphId)
      .order('priority', { ascending: false });

    if (edgesError) {
      console.error('[graphs/[id]] Error fetching edges:', edgesError);
    }

    // Fetch active config
    const { data: activeConfig, error: configError } = await supabase
      .from('graph_configs')
      .select('*')
      .eq('graph_id', graphId)
      .eq('is_active', true)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (acceptable)
      console.error('[graphs/[id]] Error fetching config:', configError);
    }

    // Fetch recent executions
    const { data: recentExecutions, error: execError } = await supabase
      .from('graph_executions')
      .select('id, status, execution_mode, cost_usd, quality_score, started_at, completed_at')
      .eq('graph_id', graphId)
      .order('started_at', { ascending: false })
      .limit(10);

    if (execError) {
      console.error('[graphs/[id]] Error fetching executions:', execError);
    }

    return NextResponse.json({
      graph,
      nodes: nodes || [],
      edges: edges || [],
      active_config: activeConfig || null,
      recent_executions: recentExecutions || [],
    });
  } catch (error) {
    console.error('[graphs/[id]] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/admin/graphs/[id]
 * Update graph metadata
 */
export const PATCH = withAuth(async (request, session, context) => {
  try {
    const params = await context.params;
    const graphId = params.id;
    const supabase = await getSupabaseAdmin();
    const body = await request.json();

    const {
      name,
      description,
      status,
      is_default,
      metadata,
      tags,
    } = body;

    // Build update object (only include provided fields)
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (is_default !== undefined) updateData.is_default = is_default;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (tags !== undefined) updateData.tags = tags;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data: graph, error } = await supabase
      .from('graphs')
      .update(updateData)
      .eq('id', graphId)
      .select()
      .single();

    if (error) {
      console.error('[graphs/[id]] Error updating graph:', error);
      return NextResponse.json(
        { error: 'Failed to update graph', details: error.message },
        { status: 500 }
      );
    }

    console.log(`[graphs/[id]] ✓ Updated graph: ${graph.name} (${graphId})`);

    return NextResponse.json({ graph });
  } catch (error) {
    console.error('[graphs/[id]] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin/graphs/[id]
 * Delete graph and all related data (cascades to nodes, edges, configs)
 */
export const DELETE = withAuth(async (request, session, context) => {
  try {
    const params = await context.params;
    const graphId = params.id;
    const supabase = await getSupabaseAdmin();

    // Check if graph exists
    const { data: graph, error: fetchError } = await supabase
      .from('graphs')
      .select('name')
      .eq('id', graphId)
      .single();

    if (fetchError || !graph) {
      return NextResponse.json(
        { error: 'Graph not found' },
        { status: 404 }
      );
    }

    // Delete graph (cascades to nodes, edges, configs)
    const { error: deleteError } = await supabase
      .from('graphs')
      .delete()
      .eq('id', graphId);

    if (deleteError) {
      console.error('[graphs/[id]] Error deleting graph:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete graph', details: deleteError.message },
        { status: 500 }
      );
    }

    console.log(`[graphs/[id]] ✓ Deleted graph: ${graph.name} (${graphId})`);

    return NextResponse.json({
      success: true,
      message: `Graph "${graph.name}" deleted successfully`,
    });
  } catch (error) {
    console.error('[graphs/[id]] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
});
