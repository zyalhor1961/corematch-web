import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
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

    console.log('Simple fix for user:', user.id, user.email);

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
    }

    // Simple approach: Just return a default organization ID
    // This bypasses the complex organization system temporarily
    const defaultOrgId = '00000000-0000-0000-0000-000000000001';

    return NextResponse.json({
      success: true,
      message: 'User setup complete - using simplified organization system',
      data: {
        user_id: user.id,
        profile: profile,
        default_org_id: defaultOrgId,
        note: 'Using simplified system without complex organization tables'
      }
    });

  } catch (error) {
    console.error('Simple fix error:', error);
    return NextResponse.json({ 
      error: 'Fix failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}