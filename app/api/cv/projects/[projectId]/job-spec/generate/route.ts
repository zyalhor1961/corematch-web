import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyAuth, verifyOrgAccess } from '@/lib/auth/verify-auth';
import { generateJobSpec } from '@/lib/cv-analysis/jobspec-generator';

export async function POST(
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

    const hasAccess = await verifyOrgAccess(user.id, project.org_id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    console.log(`[JobSpec Generate] Starting auto-generation for project: ${project.name}`);

    // Generate JobSpec via OpenAI
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

  } catch (error) {
    console.error('Generate job spec error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération automatique du JobSpec' },
      { status: 500 }
    );
  }
}
