import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/auth-middleware';

export const GET = withAuth(async (request, session) => {
  if (process.env.NODE_ENV === 'production') {
    console.error('[test-google-oauth] ⚠️ BLOCKED: Attempted access in production by user', session.user.id);
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'This route is disabled in production for security' },
      { status: 403 }
    );
  }

  console.warn(`[test-google-oauth] ⚠️ DEV ONLY: User ${session.user.id} accessing dev route`);

  try {
    console.log('[test-google-oauth] Testing Google OAuth configuration...');

    const tests = [];

    // Test 1: Check if we can access Supabase auth
    try {
      const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1
      });

      tests.push({
        test: 'Supabase Auth Access',
        success: !error,
        details: error ? error.message : `Auth accessible (${users?.users?.length || 0} users found)`
      });
    } catch (err) {
      tests.push({
        test: 'Supabase Auth Access',
        success: false,
        details: err instanceof Error ? err.message : 'Failed to access Supabase auth'
      });
    }

    // Test 2: Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    tests.push({
      test: 'Environment Configuration',
      success: !!(supabaseUrl && supabaseAnonKey),
      details: {
        supabaseUrl: supabaseUrl ? `✅ ${supabaseUrl}` : '❌ Missing NEXT_PUBLIC_SUPABASE_URL',
        supabaseAnonKey: supabaseAnonKey ? '✅ Present' : '❌ Missing NEXT_PUBLIC_SUPABASE_ANON_KEY',
        expectedCallback: `${supabaseUrl}/auth/v1/callback`
      }
    });

    // Test 3: Check for Google OAuth users (if any exist)
    try {
      const { data: allUsers, error: usersError } = await supabaseAdmin.auth.admin.listUsers();

      if (!usersError && allUsers?.users) {
        const googleUsers = allUsers.users.filter(user =>
          user.app_metadata?.provider === 'google' ||
          user.identities?.some(identity => identity.provider === 'google')
        );

        tests.push({
          test: 'Existing Google Users',
          success: true,
          details: `Found ${googleUsers.length} users with Google auth out of ${allUsers.users.length} total users`
        });
      } else {
        tests.push({
          test: 'Existing Google Users',
          success: false,
          details: usersError?.message || 'Could not check users'
        });
      }
    } catch (err) {
      tests.push({
        test: 'Existing Google Users',
        success: false,
        details: err instanceof Error ? err.message : 'Failed to check users'
      });
    }

    // Configuration instructions
    const configurationSteps = {
      urgent: [
        '🚨 URGENT: Enable Google OAuth in Supabase Dashboard',
        '1. Go to Supabase Dashboard → Authentication → Providers',
        '2. Find Google and toggle "Enable sign in with Google"',
        '3. Add Google Client ID and Client Secret',
        '4. Save configuration'
      ],
      googleConsole: [
        '📱 Google Cloud Console Setup:',
        '1. Go to https://console.cloud.google.com/',
        '2. Create OAuth 2.0 Client ID',
        '3. Add authorized origins and redirect URIs',
        `4. Use callback: ${supabaseUrl}/auth/v1/callback`
      ],
      testing: [
        '🧪 Testing Steps:',
        '1. Try Google login in development',
        '2. Check if user appears in Supabase Auth users',
        '3. Verify session is created properly',
        '4. Test in production environment'
      ]
    };

    const response = {
      success: true,
      message: 'Google OAuth configuration test completed',
      currentIssue: 'Google OAuth provider not enabled in Supabase',
      tests,
      configuration: configurationSteps,
      nextSteps: [
        '1. 🔧 Configure Google OAuth in Supabase Dashboard (CRITICAL)',
        '2. 🔑 Set up Google Cloud Console credentials',
        '3. 🧪 Test OAuth flow in development',
        '4. 🚀 Verify production configuration',
        '5. 📊 Monitor authentication logs'
      ],
      troubleshooting: {
        'provider is not enabled': 'Enable Google in Supabase Auth Providers',
        'redirect_uri_mismatch': 'Check Google Console authorized redirect URIs',
        'invalid_client': 'Verify Client ID and Secret in Supabase',
        'access_denied': 'User refused authorization (normal behavior)'
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[test-google-oauth] Google OAuth test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: 'Failed to test Google OAuth configuration',
      quickFix: [
        '1. Check Supabase Dashboard → Authentication → Providers',
        '2. Enable Google OAuth provider',
        '3. Add Google Client ID and Secret',
        '4. Test again'
      ]
    }, { status: 500 });
  }
});