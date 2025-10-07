import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { name, admin_user_id, plan = 'starter', status = 'active' } = await request.json();

    if (!name || !admin_user_id) {
      return NextResponse.json(
        { error: 'Missing required fields: name, admin_user_id' },
        { status: 400 }
      );
    }

    console.log('Creating organization:', { name, admin_user_id, plan, status });

    // Create organization using admin client (bypasses RLS)
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name,
        plan,
        status
      })
      .select()
      .single();

    if (orgError) {
      console.error('Error creating organization:', orgError);
      return NextResponse.json(
        { error: 'Failed to create organization', details: orgError.message },
        { status: 500 }
      );
    }

    console.log('Organization created:', organization);

    // Try to add user to organization_members table
    try {
      const { error: memberError } = await supabaseAdmin
        .from('organization_members')
        .insert({
          org_id: organization.id,
          user_id: admin_user_id,
          role: 'org_admin'
        });

      if (memberError) {
        console.log('Could not add to organization_members (table may not exist):', memberError);
      } else {
        console.log('User added to organization_members successfully');
      }
    } catch (membershipError) {
      console.log('Organization membership table may not exist, continuing...', membershipError);
    }

    return NextResponse.json({
      success: true,
      organization,
      message: 'Organization created successfully'
    });

  } catch (error) {
    console.error('Create organization error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}