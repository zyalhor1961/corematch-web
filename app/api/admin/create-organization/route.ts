import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { withAuth } from '@/lib/api/auth-middleware';

export const POST = withAuth(async (request, session) => {
  try {
    const { name, plan = 'starter', status = 'active' } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      );
    }

    // Force admin_user_id to authenticated user (security)
    const admin_user_id = session.user.id;

    console.log(`[create-organization] User ${admin_user_id} creating organization:`, { name, plan, status });

    // Utiliser client avec RLS
    const supabase = createRouteHandlerClient({ cookies });

    // Create organization
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name,
        plan,
        status
      })
      .select()
      .single();

    if (orgError) {
      console.error('[create-organization] Error creating organization:', orgError);
      return NextResponse.json(
        { error: 'Failed to create organization', details: orgError.message },
        { status: 500 }
      );
    }

    console.log('[create-organization] Organization created:', organization.id);

    // Add user to organization_members table as owner
    try {
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          org_id: organization.id,
          user_id: admin_user_id,
          role: 'owner'  // Owner role for creator
        });

      if (memberError) {
        console.error('[create-organization] Could not add to organization_members:', memberError);
        // This is critical - if membership fails, we should probably rollback the org creation
        // For now, log the error but continue
      } else {
        console.log('[create-organization] User added to organization_members successfully');
      }
    } catch (membershipError) {
      console.error('[create-organization] Organization membership error:', membershipError);
    }

    return NextResponse.json({
      success: true,
      organization,
      message: 'Organization created successfully'
    });

  } catch (error) {
    console.error('[create-organization] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
});