import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { secureApiRoute, logSecurityEvent } from '@/lib/auth/middleware';

/**
 * Verify user has access to project through organization membership
 */
async function verifyProjectAccess(userId: string, projectId: string, isMasterAdmin: boolean = false): Promise<{ hasAccess: boolean; orgId?: string }> {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; candidateId: string }> }
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    // Security check
    const securityResult = await secureApiRoute(request);
    if (!securityResult.success) {
      return securityResult.response!;
    }

    const { user } = securityResult;
    const { projectId, candidateId } = await params;

    // Verify user has access to this project
    const projectAccess = await verifyProjectAccess(user!.id, projectId, user!.isMasterAdmin);
    if (!projectAccess.hasAccess) {
      logSecurityEvent({
        type: 'ACCESS_DENIED',
        userId: user!.id,
        email: user!.email,
        route: `/api/cv/projects/${projectId}/candidates/${candidateId} [DELETE]`,
        details: 'Attempted to delete candidate without project access'
      });

      return NextResponse.json(
        {
          error: 'Access denied to this project',
          code: 'PROJECT_ACCESS_DENIED'
        },
        { status: 403 }
      );
    }

    if (!candidateId) {
      return NextResponse.json(
        { error: 'Candidate ID is required' },
        { status: 400 }
      );
    }

    // Log deletion attempt
    logSecurityEvent({
      type: 'SUSPICIOUS_ACTIVITY',
      userId: user!.id,
      email: user!.email,
      orgId: projectAccess.orgId,
      route: `/api/cv/projects/${projectId}/candidates/${candidateId} [DELETE]`,
      details: `Deleting candidate ${candidateId} from project ${projectId}`
    });

    // First, get candidate info to delete the CV file from storage
    const { data: candidate, error: fetchError } = await supabaseAdmin
      .from('candidates')
      .select('notes, cv_path')
      .eq('id', candidateId)
      .eq('project_id', projectId) // Security: ensure candidate belongs to this project
      .single();

    if (fetchError) {
      console.error('Error fetching candidate:', fetchError);
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    // Extract file path to delete from storage
    // Use cv_path column (fallback to regex for old records)
    const filePath = candidate.cv_path || candidate.notes?.match(/Path: ([^|]+)/)?.[1];
    if (filePath) {
      const { error: deleteFileError } = await supabaseAdmin.storage
        .from('cv')
        .remove([filePath]);

      if (deleteFileError) {
        console.warn('Warning: Could not delete CV file from storage:', deleteFileError);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete candidate record from database
    const { error: deleteError } = await supabaseAdmin
      .from('candidates')
      .delete()
      .eq('id', candidateId)
      .eq('project_id', projectId); // Security: ensure candidate belongs to this project

    if (deleteError) {
      console.error('Error deleting candidate:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete candidate' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'CV supprimé avec succès'
    });

  } catch (error) {
    console.error('Delete candidate error:', error);
    return NextResponse.json(
      { error: 'Failed to delete candidate' },
      { status: 500 }
    );
  }
}