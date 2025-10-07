import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing projectId parameter' },
        { status: 400 }
      );
    }

    console.log('Loading candidates for projectId:', projectId);

    // Get candidates using admin client (bypasses RLS and auth checks)
    const { data: candidates, error } = await supabaseAdmin
      .from('candidates')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching candidates:', error);
      return NextResponse.json(
        { error: 'Failed to fetch candidates', details: error.message },
        { status: 500 }
      );
    }

    console.log(`Found ${candidates?.length || 0} candidates for project ${projectId}`);

    return NextResponse.json({
      success: true,
      data: candidates || [],
    });

  } catch (error) {
    console.error('Candidates fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch candidates', details: (error as Error).message },
      { status: 500 }
    );
  }
}