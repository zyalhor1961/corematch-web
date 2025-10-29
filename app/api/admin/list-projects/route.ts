import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { withOrgAccess } from '@/lib/api/auth-middleware';

export const GET = withOrgAccess(async (request, session, orgId, membership) => {
  try {
    console.log(`[list-projects] User ${session.user.id} loading projects for org ${orgId}`);

    // Utiliser client avec RLS (pas supabaseAdmin!)
    const supabase = createRouteHandlerClient({ cookies });

    // Get projects (RLS actif = seulement ceux de son org)
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[list-projects] Error fetching projects:', error);
      return NextResponse.json(
        { error: 'Failed to fetch projects', details: error.message },
        { status: 500 }
      );
    }

    // Count candidates for each project
    const projectsWithCounts = await Promise.all(
      (projects || []).map(async (project) => {
        const { count: candidateCount } = await supabase
          .from('candidates')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', project.id);

        const { count: analyzedCount } = await supabase
          .from('candidates')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', project.id)
          .eq('status', 'analyzed');

        return {
          ...project,
          candidate_count: candidateCount || 0,
          analyzed_count: analyzedCount || 0,
          shortlisted_count: 0,
        };
      })
    );

    console.log(`[list-projects] Found ${projectsWithCounts.length} projects`);

    return NextResponse.json({
      success: true,
      data: projectsWithCounts,
    });
  } catch (error) {
    console.error('[list-projects] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects', details: (error as Error).message },
      { status: 500 }
    );
  }
});
