import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json(
        { error: 'Missing orgId parameter' },
        { status: 400 }
      );
    }

    console.log('Loading projects for orgId:', orgId);

    // Get projects using admin client (bypasses RLS and auth checks)
    const { data: projects, error } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      return NextResponse.json(
        { error: 'Failed to fetch projects', details: error.message },
        { status: 500 }
      );
    }

    // Count candidates for each project
    const projectsWithCounts = await Promise.all(
      (projects || []).map(async (project) => {
        const { count: candidateCount } = await supabaseAdmin
          .from('candidates')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', project.id);

        const { count: analyzedCount } = await supabaseAdmin
          .from('candidates')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', project.id)
          .eq('status', 'analyzed');

        return {
          ...project,
          candidate_count: candidateCount || 0,
          analyzed_count: analyzedCount || 0,
          shortlisted_count: 0, // TODO: implement when shortlisting is ready
        };
      })
    );

    console.log(`Found ${projectsWithCounts.length} projects for org ${orgId}`);

    return NextResponse.json({
      success: true,
      data: projectsWithCounts,
    });

  } catch (error) {
    console.error('Projects fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects', details: (error as Error).message },
      { status: 500 }
    );
  }
}