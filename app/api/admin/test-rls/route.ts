import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/auth-middleware';

export const POST = withAuth(async (request, session) => {
  if (process.env.NODE_ENV === 'production') {
    console.error('[test-rls] ⚠️ BLOCKED: Attempted access in production by user', session.user.id);
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'This route is disabled in production for security' },
      { status: 403 }
    );
  }

  console.warn(`[test-rls] ⚠️ DEV ONLY: User ${session.user.id} accessing dev route`);

  try {
    console.log('[test-rls] Starting RLS validation tests...');

    const testResults = [];

    // Test 1: Verify tables exist and are accessible
    const tables = [
      'organizations',
      'organization_members',
      'subscriptions',
      'projects',
      'candidates',
      'documents',
      'products',
      'leads',
      'usage_counters'
    ];

    for (const table of tables) {
      try {
        const { data, error, count } = await supabaseAdmin
          .from(table)
          .select('*', { count: 'exact', head: true });

        testResults.push({
          test: `Table Access: ${table}`,
          success: !error,
          details: error ? error.message : `Table accessible, ${count || 0} rows`,
          table
        });

      } catch (err) {
        testResults.push({
          test: `Table Access: ${table}`,
          success: false,
          details: err instanceof Error ? err.message : 'Unknown error',
          table
        });
      }
    }

    // Test 2: Check if admin user exists
    try {
      const { data: adminUser, error: adminError } = await supabaseAdmin.auth.admin
        .getUserById('admin@corematch.test');

      testResults.push({
        test: 'Master Admin User Check',
        success: !adminError,
        details: adminError ? adminError.message : 'Admin user accessible'
      });

    } catch (err) {
      testResults.push({
        test: 'Master Admin User Check',
        success: false,
        details: 'Could not check admin user - this is expected if user does not exist'
      });
    }

    // Test 3: Check organization data structure
    try {
      const { data: orgs, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('id, name, plan, status')
        .limit(5);

      testResults.push({
        test: 'Organization Data Structure',
        success: !orgError,
        details: orgError ? orgError.message : `Found ${orgs?.length || 0} organizations`,
        sampleData: orgs?.map(org => ({ id: org.id, name: org.name, plan: org.plan }))
      });

    } catch (err) {
      testResults.push({
        test: 'Organization Data Structure',
        success: false,
        details: err instanceof Error ? err.message : 'Unknown error'
      });
    }

    // Test 4: Check organization membership structure
    try {
      const { data: members, error: memberError } = await supabaseAdmin
        .from('organization_members')
        .select('org_id, user_id, role')
        .limit(5);

      testResults.push({
        test: 'Organization Membership Structure',
        success: !memberError,
        details: memberError ? memberError.message : `Found ${members?.length || 0} memberships`,
        sampleData: members?.map(m => ({ org_id: m.org_id, role: m.role }))
      });

    } catch (err) {
      testResults.push({
        test: 'Organization Membership Structure',
        success: false,
        details: err instanceof Error ? err.message : 'Unknown error'
      });
    }

    // Test 5: Check projects with org_id
    try {
      const { data: projects, error: projectError } = await supabaseAdmin
        .from('projects')
        .select('id, org_id, name')
        .limit(5);

      testResults.push({
        test: 'Projects with Organization Link',
        success: !projectError,
        details: projectError ? projectError.message : `Found ${projects?.length || 0} projects`,
        sampleData: projects?.map(p => ({ id: p.id, org_id: p.org_id, name: p.name }))
      });

    } catch (err) {
      testResults.push({
        test: 'Projects with Organization Link',
        success: false,
        details: err instanceof Error ? err.message : 'Unknown error'
      });
    }

    // Summary
    const successCount = testResults.filter(r => r.success).length;
    const errorCount = testResults.filter(r => !r.success).length;

    const response = {
      success: errorCount === 0,
      message: `RLS pre-migration tests completed. ${successCount}/${testResults.length} tests passed.`,
      details: {
        totalTests: testResults.length,
        successCount,
        errorCount,
        testResults,
        recommendations: [
          errorCount === 0
            ? '✅ Database structure is ready for RLS migration'
            : '⚠️ Some issues detected - review errors before applying RLS',
          '📋 Next steps: Apply the RLS migration in Supabase SQL editor',
          '🧪 After migration: Run post-migration tests to validate security',
          '📊 Monitor application logs for any access issues'
        ]
      }
    };

    console.log('[test-rls] RLS validation tests completed:', response);

    return NextResponse.json(response);

  } catch (error) {
    console.error('[test-rls] RLS validation tests failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: 'Failed to run RLS validation tests'
    }, { status: 500 });
  }
});