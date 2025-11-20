import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/auth-middleware';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const POST = withAuth(async (request, session) => {
  if (process.env.NODE_ENV === 'production') {
    console.error('[quick-login] ⚠️ BLOCKED: Attempted access in production by user', session.user.id);
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'This route is disabled in production for security' },
      { status: 403 }
    );
  }

  console.warn(`[quick-login] ⚠️ DEV ONLY: User ${session.user.id} accessing dev route`);

  try {
    const supabaseAdmin = await getSupabaseAdmin();
    console.log('[quick-login] Quick login for test admin user...');

    const testEmail = 'admin@corematch.test';
    const testPassword = 'AdminTest123!';

    // Sign in the test user
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (signInError) {
      console.error('[quick-login] Sign in error:', signInError);
      return NextResponse.json({
        success: false,
        error: 'Failed to sign in test user',
        details: signInError.message
      }, { status: 401 });
    }

    console.log('[quick-login] Test user signed in successfully');

    // Create response with session cookies
    const response = NextResponse.json({
      success: true,
      message: 'Logged in as test admin user',
      user: {
        id: signInData.user.id,
        email: signInData.user.email,
        role: 'admin'
      },
      redirectTo: '/org/00000000-0000-0000-0000-000000000001/cv'
    });

    // Set auth cookies
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            response.cookies.set(name, value, options);
          },
          remove(name: string, options: any) {
            response.cookies.set(name, '', { ...options, maxAge: 0 });
          },
        },
      }
    );

    // Set the session
    await supabase.auth.setSession({
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token
    });

    return response;

  } catch (error) {
    console.error('[quick-login] Quick login error:', error);
    return NextResponse.json({
      success: false,
      error: 'Quick login failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
});

export const GET = withAuth(async (request, session) => {
  if (process.env.NODE_ENV === 'production') {
    console.error('[quick-login] ⚠️ BLOCKED: Attempted GET access in production by user', session.user.id);
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'This route is disabled in production for security' },
      { status: 403 }
    );
  }

  console.warn(`[quick-login] ⚠️ DEV ONLY: User ${session.user.id} accessing GET route`);
  return NextResponse.redirect(new URL('/org/00000000-0000-0000-0000-000000000001/cv', request.url));
});