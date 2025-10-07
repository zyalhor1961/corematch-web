import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
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
    const body = await request.json();
    const { orgId, name, description, job_title, requirements, created_by } = createProjectSchema.parse(body);

    console.log('Creating project (admin):', { orgId, name, created_by });

    // Create project using admin client (bypasses RLS and auth checks)
    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .insert({
        org_id: orgId,
        name,
        description,
        job_title,
        requirements,
        created_by,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating project:', error);
      return NextResponse.json(
        { error: 'Failed to create project', details: error.message },
        { status: 500 }
      );
    }

    console.log('Project created successfully:', project);

    return NextResponse.json({
      success: true,
      project,
      message: 'Project created successfully'
    });

  } catch (error) {
    console.error('Project creation error:', error);
    return NextResponse.json(
      { error: 'Invalid request data', details: (error as Error).message },
      { status: 400 }
    );
  }
}