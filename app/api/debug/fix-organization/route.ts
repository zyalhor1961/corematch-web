import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    // Get user from auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No auth token' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Verify token and get user
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    console.log('Fixing organization for user:', user.id, user.email);

    // Check if user has a profile
    let { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Create profile if it doesn't exist
    if (profileError || !profile) {
      const { data: newProfile, error: createProfileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
          role: 'startup'
        })
        .select()
        .single();

      if (createProfileError) {
        console.error('Error creating profile:', createProfileError);
        return NextResponse.json({ 
          error: 'Failed to create profile',
          details: createProfileError.message 
        }, { status: 500 });
      }
      
      profile = newProfile;
      console.log('Created profile for user:', profile);
    }

    // Check if user has any organizations
    const { data: existingOrgs, error: orgError } = await supabaseAdmin
      .from('my_orgs')
      .select('*')
      .eq('user_id', user.id);

    if (orgError) {
      console.error('Error checking organizations:', orgError);
    }

    console.log('Existing organizations:', existingOrgs);

    // If no organizations, create one
    if (!existingOrgs || existingOrgs.length === 0) {
      // First create the organization
      const { data: newOrg, error: createOrgError } = await supabaseAdmin
        .from('organizations')
        .insert({
          name: `${profile.full_name || user.email?.split('@')[0]}'s Organization`,
          plan: 'free',
          status: 'active'
        })
        .select()
        .single();

      if (createOrgError) {
        console.error('Error creating organization:', createOrgError);
        return NextResponse.json({ 
          error: 'Failed to create organization',
          details: createOrgError.message 
        }, { status: 500 });
      }

      console.log('Created organization:', newOrg);

      // Then add user as organization member
      const { data: membership, error: memberError } = await supabaseAdmin
        .from('organization_members')
        .insert({
          org_id: newOrg.id,
          user_id: user.id,
          role: 'org_admin'
        })
        .select()
        .single();

      if (memberError) {
        console.error('Error creating membership:', memberError);
        return NextResponse.json({ 
          error: 'Failed to create membership',
          details: memberError.message 
        }, { status: 500 });
      }

      console.log('Created membership:', membership);

      return NextResponse.json({
        success: true,
        message: 'Organization created and user assigned',
        data: {
          organization: newOrg,
          membership: membership,
          profile: profile
        }
      });
    } else {
      return NextResponse.json({
        success: true,
        message: 'User already has organization(s)',
        data: {
          organizations: existingOrgs,
          profile: profile
        }
      });
    }

  } catch (error) {
    console.error('Fix organization error:', error);
    return NextResponse.json({ 
      error: 'Fix failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}