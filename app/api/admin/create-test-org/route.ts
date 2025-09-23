import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    console.log('Creating test organization...');

    // Try to create organization - ignore RLS errors for admin operations
    let org = null;
    let orgError = null;

    try {
      const result = await supabaseAdmin
        .from('organizations')
        .insert({
          id: '00000000-0000-0000-0000-000000000001',
          name: 'Test Organization',
          plan: 'starter',
          status: 'active'
        })
        .select()
        .single();

      org = result.data;
      orgError = result.error;
    } catch (error) {
      // If this fails due to RLS, try to get existing org
      if (error instanceof Error && error.message.includes('row-level security')) {
        const { data: existingOrg } = await supabaseAdmin
          .from('organizations')
          .select('*')
          .eq('id', '00000000-0000-0000-0000-000000000001')
          .single();

        if (existingOrg) {
          org = existingOrg;
          orgError = null;
        } else {
          orgError = error;
        }
      } else {
        orgError = error;
      }
    }

    if (orgError && !orgError.message.includes('duplicate key')) {
      console.error('Error creating organization:', orgError);
      return NextResponse.json({
        success: false,
        error: 'Failed to create organization',
        details: orgError.message
      }, { status: 500 });
    }

    console.log('Organization created or already exists');

    // Now try to create a test project
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .insert({
        org_id: '00000000-0000-0000-0000-000000000001',
        name: 'Test Project',
        description: 'Test description',
        job_title: 'Développeur Test',
        requirements: 'Test requirements',
        created_by: null,
      })
      .select()
      .single();

    if (projectError) {
      console.error('Error creating project:', projectError);
      return NextResponse.json({
        success: false,
        error: 'Failed to create project',
        details: projectError.message
      }, { status: 500 });
    }

    console.log('Test project created successfully:', project);

    return NextResponse.json({
      success: true,
      organization: org,
      project: project,
      message: 'Test organization and project created successfully'
    });

  } catch (error) {
    console.error('Create test org error:', error);
    return NextResponse.json({
      success: false,
      error: 'Test org creation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}