import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { verifyAuth, verifyOrgAccess } from '@/lib/auth/verify-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { projectId } = await params;

    // Get project with criteria
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id, name, org_id, analysis_criteria')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Verify user has access to the organization
    const hasAccess = await verifyOrgAccess(user.id, project.org_id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        projectId: project.id,
        projectName: project.name,
        criteria: project.analysis_criteria || []
      }
    });

  } catch (error) {
    console.error('Get criteria error:', error);
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
    const supabaseAdmin = await getSupabaseAdmin();

    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { projectId } = await params;
    const body = await request.json();
    const { criteria } = body;

    if (!Array.isArray(criteria)) {
      return NextResponse.json(
        { error: 'Criteria must be an array' },
        { status: 400 }
      );
    }

    // SECURITY: Validate criteria structure
    for (const criterion of criteria) {
      if (!criterion.id || !criterion.name || typeof criterion.weight !== 'number') {
        return NextResponse.json(
          { error: 'Invalid criterion structure' },
          { status: 400 }
        );
      }

      if (criterion.weight < 1 || criterion.weight > 5) {
        return NextResponse.json(
          { error: 'Criterion weight must be between 1 and 5' },
          { status: 400 }
        );
      }

      // SECURITY: Limit string lengths
      if (criterion.name.length > 100 || criterion.description.length > 500) {
        return NextResponse.json(
          { error: 'Criterion name or description too long' },
          { status: 400 }
        );
      }
    }

    // SECURITY: Limit number of criteria
    if (criteria.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 criteria allowed' },
        { status: 400 }
      );
    }

    // Get project
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id, org_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Verify user has access to the organization
    const hasAccess = await verifyOrgAccess(user.id, project.org_id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    // Update project with new criteria
    const { error: updateError } = await supabaseAdmin
      .from('projects')
      .update({ analysis_criteria: criteria })
      .eq('id', projectId);

    if (updateError) {
      console.error('Update criteria error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update criteria' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${criteria.length} critères sauvegardés avec succès`,
      data: { criteria }
    });

  } catch (error) {
    console.error('Update criteria error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
