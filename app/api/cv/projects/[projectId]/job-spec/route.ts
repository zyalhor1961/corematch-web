import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyAuth, verifyProjectAccess } from '@/lib/auth/verify-auth';
import type { JobSpec } from '@/lib/cv-analysis/deterministic-evaluator';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { projectId } = await params;

    // Verify project access
    const hasAccess = await verifyProjectAccess(user.id, projectId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to this project' },
        { status: 403 }
      );
    }

    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id, name, org_id, job_spec_config, job_title, requirements, description')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        projectId: project.id,
        projectName: project.name,
        jobSpec: project.job_spec_config,
        // Info projet pour génération auto si pas de jobSpec
        projectInfo: {
          job_title: project.job_title,
          requirements: project.requirements,
          description: project.description
        }
      }
    });

  } catch (error) {
    console.error('Get job spec error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { projectId } = await params;
    const body = await request.json();
    const { jobSpec } = body as { jobSpec: JobSpec };

    // SECURITY: Validate jobSpec structure
    if (!jobSpec.title || !Array.isArray(jobSpec.must_have)) {
      return NextResponse.json(
        { error: 'Invalid JobSpec structure' },
        { status: 400 }
      );
    }

    // SECURITY: Validate lengths
    if (jobSpec.must_have.length > 50) {
      return NextResponse.json(
        { error: 'Too many must_have rules (max 50)' },
        { status: 400 }
      );
    }

    if (jobSpec.skills_required.length > 100) {
      return NextResponse.json(
        { error: 'Too many skills_required (max 100)' },
        { status: 400 }
      );
    }

    // Verify project access
    const hasAccess = await verifyProjectAccess(user.id, projectId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to this project' },
        { status: 403 }
      );
    }

    // Update project with jobSpec
    const { error: updateError } = await supabaseAdmin
      .from('projects')
      .update({ job_spec_config: jobSpec })
      .eq('id', projectId);

    if (updateError) {
      console.error('Update job spec error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update job spec' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Configuration JOB_SPEC sauvegardée avec succès',
      data: { jobSpec }
    });

  } catch (error) {
    console.error('Update job spec error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
