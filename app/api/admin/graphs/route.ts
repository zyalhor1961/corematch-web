/**
 * Admin API: Graphs CRUD
 *
 * GET /api/admin/graphs - List all graphs
 * POST /api/admin/graphs - Create new graph
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/auth-middleware';

/**
 * GET /api/admin/graphs
 * List all workflow graphs with optional filtering
 */
export const GET = withAuth(async (request, session) => {
  try {
    const supabase = await getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    // Optional filters
    const type = searchParams.get('type'); // cv_analysis | document_processing | custom
    const status = searchParams.get('status'); // draft | active | archived
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('graphs')
      .select(`
        *,
        graph_nodes:graph_nodes(count),
        graph_edges:graph_edges(count),
        graph_configs:graph_configs(count),
        graph_executions:graph_executions(count)
      `, { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (type) {
      query = query.eq('graph_type', type);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: graphs, error, count } = await query;

    if (error) {
      console.error('[graphs] Error fetching graphs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch graphs', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      graphs: graphs || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[graphs] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/graphs
 * Create a new workflow graph
 */
export const POST = withAuth(async (request, session) => {
  try {
    const supabase = await getSupabaseAdmin();
    const body = await request.json();

    const {
      name,
      description,
      graph_type,
      status = 'draft',
      is_default = false,
      metadata = {},
      tags = [],
    } = body;

    // Validation
    if (!name || !graph_type) {
      return NextResponse.json(
        { error: 'Missing required fields: name, graph_type' },
        { status: 400 }
      );
    }

    // Create graph
    const { data: graph, error } = await supabase
      .from('graphs')
      .insert({
        name,
        description,
        graph_type,
        status,
        is_default,
        metadata,
        tags,
        created_by: session.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('[graphs] Error creating graph:', error);
      return NextResponse.json(
        { error: 'Failed to create graph', details: error.message },
        { status: 500 }
      );
    }

    console.log(`[graphs] ✓ Created graph: ${graph.name} (${graph.id})`);

    return NextResponse.json({ graph }, { status: 201 });
  } catch (error) {
    console.error('[graphs] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
});
