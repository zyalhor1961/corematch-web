import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/auth-middleware';

export const POST = withAuth(async (request, session) => {
  if (process.env.NODE_ENV === 'production') {
    console.error('[simple-login] ⚠️ BLOCKED: Attempted access in production by user', session.user.id);
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'This route is disabled in production for security' },
      { status: 403 }
    );
  }

  console.warn(`[simple-login] ⚠️ DEV ONLY: User ${session.user.id} accessing dev route`);

  try {
    console.log('[simple-login] Simple login for test admin user...');

    const testEmail = 'admin@corematch.test';
    const testPassword = 'AdminTest123!';

    // Sign in the test user
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (signInError) {
      console.error('[simple-login] Sign in error:', signInError);
      return NextResponse.json({
        success: false,
        error: 'Failed to sign in test user',
        details: signInError.message
      }, { status: 401 });
    }

    console.log('[simple-login] Test user signed in successfully');

    // Return session data for manual setting
    return NextResponse.json({
      success: true,
      message: 'Test user authenticated',
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        expires_at: signInData.session.expires_at,
        user: {
          id: signInData.user.id,
          email: signInData.user.email
        }
      },
      instructions: [
        '1. Copy the access_token',
        '2. Go to your browser dev tools > Application > Local Storage',
        '3. Set sb-glexllbywdvlxpbanjmn-auth-token with the token',
        '4. Refresh the page'
      ],
      directLoginUrl: `/org/00000000-0000-0000-0000-000000000001/cv?token=${signInData.session.access_token}`
    });

  } catch (error) {
    console.error('[simple-login] Simple login error:', error);
    return NextResponse.json({
      success: false,
      error: 'Simple login failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
});