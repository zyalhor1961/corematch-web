import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

import { withOrgAccessFromBody } from '@/lib/api/auth-middleware';
import { z } from 'zod';

const createProjectSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  job_title: z.string().optional(),
  requirements: z.string().optional(),
});

export const POST = withOrgAccessFromBody(async (request, session, orgId, membership) => {
  try {
    const body = (request as any).parsedBody || await request.json();
    const { name, description, job_title, requirements } = createProjectSchema.parse(body);

    console.log(`[create-project] User ${session.user.id} creating project in org ${orgId}`);

    // Utiliser client avec RLS
    // Use admin client to bypass RLS for creation operations

    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .insert({
        org_id: orgId,
        name,
        description,
        job_title,
        requirements,
        created_by: session.user.id,  // Utiliser l'user authentifié
      })
      .select()
      .single();

    if (error) {
      console.error('[create-project] Error:', error);
      return NextResponse.json(
        { error: 'Failed to create project', details: error.message },
        { status: 500 }
      );
    }

    console.log('[create-project] Project created successfully:', project.id);

    return NextResponse.json({
      success: true,
      project,
      message: 'Project created successfully',
    });
  } catch (error) {
    console.error('[create-project] Validation error:', error);
    return NextResponse.json(
      { error: 'Invalid request data', details: (error as Error).message },
      { status: 400 }
    );
  }
});
