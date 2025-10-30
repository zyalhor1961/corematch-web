import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    console.log('Test project creation without auth...');

    const body = await request.json();
    const { orgId, name, description, job_title, requirements } = body;

    console.log('Creating test project:', { orgId, name, job_title });

    // Create project without auth checks
    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .insert({
        org_id: orgId || 'test-org-id',
        name: name || 'Test Project',
        description: description || 'Test description',
        job_title: job_title || 'Test Job',
        requirements: requirements || 'Test requirements',
        created_by: null, // No auth for test
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating project:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to create project',
        details: error.message
      }, { status: 500 });
    }

    console.log('Project created successfully:', project);

    return NextResponse.json({
      success: true,
      data: project,
    });

  } catch (error) {
    console.error('Test project creation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Test project creation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    console.log('Test projects fetch...');

    const { data: projects, error } = await supabaseAdmin
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching projects:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch projects',
        details: error.message
      }, { status: 500 });
    }

    console.log('Projects fetched successfully:', projects?.length || 0);

    return NextResponse.json({
      success: true,
      data: projects || [],
    });

  } catch (error) {
    console.error('Test projects fetch error:', error);
    return NextResponse.json({
      success: false,
      error: 'Test projects fetch failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}