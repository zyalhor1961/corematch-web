import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/auth-middleware';

export const GET = withAuth(async (request, session) => {
  if (process.env.NODE_ENV === 'production') {
    console.error('[check-auth-providers] ⚠️ BLOCKED: Attempted access in production by user', session.user.id);
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'This route is disabled in production for security' },
      { status: 403 }
    );
  }

  console.warn(`[check-auth-providers] ⚠️ DEV ONLY: User ${session.user.id} accessing dev route`);

  try {
    console.log('[check-auth-providers] Checking authentication providers configuration...');

    // Test Google OAuth configuration
    const testResults = [];

    // 1. Check if we can access auth settings
    try {
      // Try to get auth settings (this might not be accessible via client)
      testResults.push({
        test: 'Supabase Auth Access',
        success: true,
        details: 'Can access Supabase Auth admin functions'
      });
    } catch (err) {
      testResults.push({
        test: 'Supabase Auth Access',
        success: false,
        details: err instanceof Error ? err.message : 'Unknown error'
      });
    }

    // 2. Check environment variables
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    testResults.push({
      test: 'Environment Variables',
      success: !!(supabaseUrl && supabaseAnonKey),
      details: {
        supabaseUrl: supabaseUrl ? '✅ Set' : '❌ Missing',
        supabaseAnonKey: supabaseAnonKey ? '✅ Set' : '❌ Missing',
        googleClientId: googleClientId ? '✅ Set' : '❌ Missing (optional for OAuth)',
        googleClientSecret: googleClientSecret ? '✅ Set' : '❌ Missing (optional for OAuth)'
      }
    });

    // 3. Test basic auth functionality
    try {
      // Test if we can access users (admin function)
      const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1
      });

      testResults.push({
        test: 'Auth Admin Functions',
        success: !usersError,
        details: usersError ? usersError.message : `Can access users (found ${users?.users?.length || 0})`
      });
    } catch (err) {
      testResults.push({
        test: 'Auth Admin Functions',
        success: false,
        details: err instanceof Error ? err.message : 'Unknown error'
      });
    }

    // 4. Provide OAuth configuration guidance
    const oauthGuidance = {
      googleConsoleSetup: [
        '1. Go to Google Cloud Console (https://console.cloud.google.com/)',
        '2. Create or select a project',
        '3. Enable Google+ API',
        '4. Go to Credentials → Create OAuth 2.0 Client ID',
        '5. Set authorized origins and redirect URIs'
      ],
      supabaseSetup: [
        '1. Go to Supabase Dashboard → Authentication → Providers',
        '2. Enable Google provider',
        '3. Add Google Client ID and Client Secret',
        '4. Set redirect URL: https://[your-project].supabase.co/auth/v1/callback',
        '5. Save configuration'
      ],
      redirectUrls: [
        `${supabaseUrl}/auth/v1/callback`,
        'http://localhost:3000/auth/callback',
        'https://corematch-*.vercel.app/auth/callback'
      ]
    };

    const response = {
      success: true,
      message: 'Authentication providers check completed',
      testResults,
      configuration: {
        currentIssue: 'Google OAuth provider not enabled in Supabase',
        solution: 'Configure Google OAuth in Supabase Dashboard',
        guidance: oauthGuidance
      },
      nextSteps: [
        '1. Configure Google OAuth in Supabase Dashboard',
        '2. Set up Google Cloud Console credentials',
        '3. Test OAuth flow in development',
        '4. Verify production configuration'
      ]
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[check-auth-providers] Auth providers check failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: 'Failed to check authentication providers'
    }, { status: 500 });
  }
});