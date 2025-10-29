import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { withOrgAccess } from '@/lib/api/auth-middleware';

export const GET = withOrgAccess(async (request, session, orgId, membership) => {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing projectId parameter' },
        { status: 400 }
      );
    }

    console.log(`[get-project] User ${session.user.id} loading project ${projectId}`);

    // Utiliser client avec RLS
    const supabase = await createSupabaseServerClient();

    // Get project and verify it belongs to user's org
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('org_id', orgId)
      .single();

    if (error || !project) {
      console.error('[get-project] Access denied or project not found:', { userId: session.user.id, projectId, orgId, error: error?.message });
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 403 }
      );
    }

    console.log(`[get-project] Found project: ${project.name}`);

    return NextResponse.json({
      success: true,
      data: project,
    });

  } catch (error) {
    console.error('[get-project] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project', details: (error as Error).message },
      { status: 500 }
    );
  }
});