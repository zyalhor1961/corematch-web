import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { verifyAuth, verifyProjectAccess } from '@/lib/auth/verify-auth';
import { generateJobSpec } from '@/lib/cv-analysis/jobspec-generator';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

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

    // Get project
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id, name, org_id, job_title, description, requirements')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    console.log(`[JobSpec Generate] Starting auto-generation for project: ${project.name}`);

    // Validate project has sufficient info
    if (!project.job_title && !project.name) {
      return NextResponse.json(
        { error: 'Project must have a job_title or name for generation' },
        { status: 400 }
      );
    }

    // Generate JobSpec via OpenAI
    try {
      const jobSpec = await generateJobSpec({
        job_title: project.job_title || project.name,
        description: project.description,
        requirements: project.requirements
      });

      console.log('[JobSpec Generate] Generation successful');

      return NextResponse.json({
        success: true,
        message: 'JobSpec généré automatiquement avec succès',
        data: { jobSpec }
      });
    } catch (genError) {
      console.error('[JobSpec Generate] Generation failed:', genError);
      const errorMessage = genError instanceof Error ? genError.message : 'Unknown error';
      return NextResponse.json(
        {
          error: 'Échec de la génération automatique',
          details: errorMessage
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[JobSpec Generate] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Erreur lors de la génération automatique du JobSpec',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
