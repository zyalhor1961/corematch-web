import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyAuth, verifyOrgAccess } from '@/lib/auth/verify-auth';
import { z } from 'zod';

const createProjectSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  job_title: z.string().optional(),
  requirements: z.string().optional(),
  created_by: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { orgId, name, description, job_title, requirements } = createProjectSchema.parse(body);
    
    // Verify user has access to this organization
    const hasAccess = await verifyOrgAccess(user.id, orgId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    // Create project with authenticated user as creator
    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .insert({
        org_id: orgId,
        name,
        description,
        job_title,
        requirements,
        created_by: user.id,  // Use authenticated user's ID
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating project:', error);
      return NextResponse.json(
        { error: 'Failed to create project' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: project,
    });

  } catch (error) {
    console.error('Project creation error:', error);
    return NextResponse.json(
      { error: 'Invalid request data' },
      { status: 400 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json(
        { error: 'Missing orgId parameter' },
        { status: 400 }
      );
    }
    
    // Verify user has access to this organization
    const hasAccess = await verifyOrgAccess(user.id, orgId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    const { data: projects, error } = await supabaseAdmin
      .from('projects')
      .select(`
        *
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      return NextResponse.json(
        { error: 'Failed to fetch projects' },
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

    return NextResponse.json({
      success: true,
      data: projectsWithCounts,
    });

  } catch (error) {
    console.error('Projects fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}