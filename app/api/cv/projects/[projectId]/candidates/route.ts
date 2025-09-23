import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { secureApiRoute, logSecurityEvent } from '@/lib/auth/middleware';

/**
 * Verify user has access to project through organization membership
 */
async function verifyProjectAccess(userId: string, projectId: string, isMasterAdmin: boolean = false): Promise<{ hasAccess: boolean; orgId?: string }> {
  try {
    // Master admin has access to all projects
    if (isMasterAdmin) {
      const { data: project } = await supabaseAdmin
        .from('projects')
        .select('org_id')
        .eq('id', projectId)
        .single();

      return {
        hasAccess: true,
        orgId: project?.org_id
      };
    }

    // Get project's organization
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('org_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error('Project not found:', projectError);
      return { hasAccess: false };
    }

    // Check if user is member of the project's organization
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('user_id', userId)
      .eq('org_id', project.org_id)
      .single();

    if (membershipError || !membership) {
      console.error('User not member of organization:', membershipError);
      return { hasAccess: false };
    }

    return {
      hasAccess: true,
      orgId: project.org_id
    };
  } catch (error) {
    console.error('Project access verification failed:', error);
    return { hasAccess: false };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    // Security check
    const securityResult = await secureApiRoute(request);
    if (!securityResult.success) {
      return securityResult.response!;
    }

    const { user } = securityResult;
    const { projectId } = await params;

    // Verify user has access to this project
    const projectAccess = await verifyProjectAccess(user!.id, projectId, user!.isMasterAdmin);
    if (!projectAccess.hasAccess) {
      logSecurityEvent({
        type: 'ACCESS_DENIED',
        userId: user!.id,
        email: user!.email,
        route: `/api/cv/projects/${projectId}/candidates [GET]`,
        details: 'Attempted to access candidates without project access'
      });

      return NextResponse.json(
        {
          error: 'Access denied to this project',
          code: 'PROJECT_ACCESS_DENIED'
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const shortlisted = searchParams.get('shortlisted');

    // Log access for security monitoring
    logSecurityEvent({
      type: 'SUSPICIOUS_ACTIVITY',
      userId: user!.id,
      email: user!.email,
      orgId: projectAccess.orgId,
      route: `/api/cv/projects/${projectId}/candidates [GET]`,
      details: `Accessing candidates for project ${projectId}`
    });

    let query = supabaseAdmin
      .from('candidates')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    // shortlisted column doesn't exist yet - skip this filter
    // if (shortlisted === 'true') {
    //   query = query.eq('shortlisted', true);
    // }

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
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    // Security check
    const securityResult = await secureApiRoute(request);
    if (!securityResult.success) {
      return securityResult.response!;
    }

    const { user } = securityResult;
    const { projectId } = await params;

    // Verify user has access to this project
    const projectAccess = await verifyProjectAccess(user!.id, projectId, user!.isMasterAdmin);
    if (!projectAccess.hasAccess) {
      logSecurityEvent({
        type: 'ACCESS_DENIED',
        userId: user!.id,
        email: user!.email,
        route: `/api/cv/projects/${projectId}/candidates [PATCH]`,
        details: 'Attempted to modify candidates without project access'
      });

      return NextResponse.json(
        {
          error: 'Access denied to this project',
          code: 'PROJECT_ACCESS_DENIED'
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { candidateIds, action, shortlisted } = body;

    // Log modification attempt
    logSecurityEvent({
      type: 'SUSPICIOUS_ACTIVITY',
      userId: user!.id,
      email: user!.email,
      orgId: projectAccess.orgId,
      route: `/api/cv/projects/${projectId}/candidates [PATCH]`,
      details: `Modifying candidates: ${action} for ${candidateIds?.length || 0} candidates`
    });

    if (!candidateIds || !Array.isArray(candidateIds)) {
      return NextResponse.json(
        { error: 'candidateIds must be an array' },
        { status: 400 }
      );
    }

    const updates: Record<string, boolean | string> = {};

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