import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const projectId = params.projectId;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const shortlisted = searchParams.get('shortlisted');

    let query = supabaseAdmin
      .from('candidates')
      .select('*')
      .eq('project_id', projectId)
      .order('score', { ascending: false, nullsLast: true });

    if (status) {
      query = query.eq('status', status);
    }

    if (shortlisted === 'true') {
      query = query.eq('shortlisted', true);
    }

    const { data: candidates, error } = await query;

    if (error) {
      console.error('Error fetching candidates:', error);
      return NextResponse.json(
        { error: 'Failed to fetch candidates' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: candidates || [],
    });

  } catch (error) {
    console.error('Candidates fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch candidates' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const projectId = params.projectId;
    const body = await request.json();
    const { candidateIds, action, shortlisted } = body;

    if (!candidateIds || !Array.isArray(candidateIds)) {
      return NextResponse.json(
        { error: 'candidateIds must be an array' },
        { status: 400 }
      );
    }

    let updates: any = {};

    if (action === 'shortlist' || shortlisted !== undefined) {
      updates.shortlisted = shortlisted ?? true;
    }

    if (action === 'reject') {
      updates.status = 'rejected';
      updates.shortlisted = false;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('candidates')
      .update(updates)
      .eq('project_id', projectId)
      .in('id', candidateIds)
      .select();

    if (error) {
      console.error('Error updating candidates:', error);
      return NextResponse.json(
        { error: 'Failed to update candidates' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { updated: data?.length || 0 },
    });

  } catch (error) {
    console.error('Candidates update error:', error);
    return NextResponse.json(
      { error: 'Failed to update candidates' },
      { status: 500 }
    );
  }
}