import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    console.log('Creating test admin user...');

    const testEmail = 'admin@corematch.test';
    const testPassword = 'AdminTest123!';

    // Create test user with Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        full_name: 'Admin Test',
        role: 'admin'
      }
    });

    if (authError) {
      console.error('Auth user creation error:', authError);

      // If user already exists, try to get the existing user
      if (authError.message.includes('already registered')) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers.users.find(u => u.email === testEmail);

        if (existingUser) {
          console.log('User already exists, using existing user:', existingUser.id);

          return NextResponse.json({
            success: true,
            message: 'Test admin user already exists',
            credentials: {
              email: testEmail,
              password: testPassword
            },
            user: {
              id: existingUser.id,
              email: existingUser.email,
              created_at: existingUser.created_at
            }
          });
        }
      }

      return NextResponse.json({
        success: false,
        error: 'Failed to create auth user',
        details: authError.message
      }, { status: 500 });
    }

    const userId = authData.user.id;
    console.log('Auth user created:', userId);

    // Create profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email: testEmail,
        full_name: 'Admin Test',
        role: 'admin'
      })
      .select()
      .single();

    if (profileError) {
      console.error('Profile creation error:', profileError);
    } else {
      console.log('Profile created:', profile);
    }

    // Create or get default organization
    let { data: defaultOrg, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single();

    if (orgError || !defaultOrg) {
      const { data: newOrg, error: createOrgError } = await supabaseAdmin
        .from('organizations')
        .upsert({
          id: '00000000-0000-0000-0000-000000000001',
          name: 'CoreMatch Test Organization',
          plan: 'pro',
          status: 'active'
        })
        .select()
        .single();

      if (createOrgError) {
        console.error('Organization creation error:', createOrgError);
      } else {
        defaultOrg = newOrg;
        console.log('Organization created:', defaultOrg);
      }
    }

    // Add user to organization as admin
    const { data: membership, error: memberError } = await supabaseAdmin
      .from('organization_members')
      .upsert({
        org_id: '00000000-0000-0000-0000-000000000001',
        user_id: userId,
        role: 'org_admin'
      })
      .select()
      .single();

    if (memberError) {
      console.error('Membership creation error:', memberError);
    } else {
      console.log('Membership created:', membership);
    }

    // Create a simple login endpoint for quick access
    const loginUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`;

    return NextResponse.json({
      success: true,
      message: 'Test admin user created successfully',
      credentials: {
        email: testEmail,
        password: testPassword
      },
      user: {
        id: userId,
        email: testEmail,
        role: 'admin'
      },
      organization: defaultOrg,
      quickLogin: {
        url: '/api/admin/quick-login',
        info: 'Use this endpoint to automatically log in as test user'
      },
      instructions: [
        '1. Use the credentials above to log in normally',
        '2. Or call POST /api/admin/quick-login for automatic login',
        '3. The user has admin access to the test organization'
      ]
    });

  } catch (error) {
    console.error('Create test user error:', error);
    return NextResponse.json({
      success: false,
      error: 'Test user creation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}