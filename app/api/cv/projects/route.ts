import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';
import { secureApiRoute, logSecurityEvent } from '@/lib/auth/middleware';

const createProjectSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  job_title: z.string().optional(),
  requirements: z.string().optional(),
});


export async function POST(request: NextRequest) {
  try {
    // Security check with organization access verification
    const securityResult = await secureApiRoute(request, {
      requireOrgAccess: true,
      orgIdSource: 'body',
      orgIdParam: 'orgId'
    });

    if (!securityResult.success) {
      return securityResult.response!;
    }

    const { user, orgId } = securityResult;

    const body = await request.json();
    const { name, description, job_title, requirements } = createProjectSchema.parse(body);

    console.log('Creating project for user:', user!.id, 'orgId:', orgId);

    // Log security event for project creation
    logSecurityEvent({
      type: 'SUSPICIOUS_ACTIVITY',
      userId: user!.id,
      email: user!.email,
      orgId: orgId!,
      route: '/api/cv/projects [POST]',
      details: `Project creation: ${name}`
    });

    // Create project with authenticated user as creator
    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .insert({
        org_id: orgId!,
        name,
        description,
        job_title,
        requirements,
        created_by: user!.id,
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
    // Security check with organization access verification
    const securityResult = await secureApiRoute(request, {
      requireOrgAccess: true,
      allowMasterAdmin: true, // Master admin can see all projects
      orgIdSource: 'query',
      orgIdParam: 'orgId'
    });

    if (!securityResult.success) {
      return securityResult.response!;
    }

    const { user, orgId } = securityResult;

    console.log('Loading projects for user:', user!.id, 'orgId:', orgId, 'isMasterAdmin:', user!.isMasterAdmin);

    // Log access for security monitoring
    logSecurityEvent({
      type: 'SUSPICIOUS_ACTIVITY',
      userId: user!.id,
      email: user!.email,
      orgId: orgId!,
      route: '/api/cv/projects [GET]',
      details: user!.isMasterAdmin ? 'Master admin accessing all projects' : 'Regular user accessing org projects'
    });

    let projects;
    let error;

    if (user!.isMasterAdmin) {
      // Master admin sees ALL projects from ALL organizations
      const { data: allProjects, error: allError } = await supabaseAdmin
        .from('projects')
        .select(`
          *,
          organizations!inner(name)
        `)
        .order('created_at', { ascending: false });

      projects = allProjects;
      error = allError;
      console.log('Master admin accessing all projects:', allProjects?.length || 0, 'projects');
    } else {
      // Regular users see only their organization's projects
      console.log('Regular user accessing orgId:', orgId);

      const { data: orgProjects, error: orgError } = await supabaseAdmin
        .from('projects')
        .select(`
          *
        `)
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false });

      projects = orgProjects;
      error = orgError;
    }

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

        // Enhanced project data for master admin
        const enhancedProject = {
          ...project,
          candidate_count: candidateCount || 0,
          analyzed_count: analyzedCount || 0,
          shortlisted_count: 0,
        };

        // Add organization name for master admin view
        if (user!.isMasterAdmin && project.organizations) {
          enhancedProject.organization_name = project.organizations.name;
        }

        return enhancedProject;
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