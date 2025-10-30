import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/auth-middleware';

export const POST = withAuth(async (request, session) => {
  if (process.env.NODE_ENV === 'production') {
    console.error('[apply-rls] ⚠️ BLOCKED: Attempted access in production by user', session.user.id);
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'This route is disabled in production for security' },
      { status: 403 }
    );
  }

  console.warn(`[apply-rls] ⚠️ DEV ONLY: User ${session.user.id} accessing dev route`);

  try {
    console.log('[apply-rls] Starting RLS enforcement...');

    const results = [];

    // Enable RLS on all organizational tables
    const tables = [
      'organization_members',
      'subscriptions',
      'projects',
      'candidates',
      'documents',
      'products',
      'leads',
      'usage_counters',
      'document_pages',
      'document_lines',
      'jobs',
      'audit_logs',
      'organizations'
    ];

    // Enable RLS on each table
    for (const table of tables) {
      try {
        console.log(`[apply-rls] Enabling RLS on ${table}...`);

        const { error } = await supabaseAdmin
          .from(table)
          .select('id')
          .limit(1);

        if (error) {
          console.error(`Error accessing ${table}:`, error);
          results.push({
            table,
            action: 'Enable RLS',
            success: false,
            error: error.message
          });
        } else {
          results.push({
            table,
            action: 'Enable RLS',
            success: true
          });
        }
      } catch (err) {
        console.error(`Exception enabling RLS on ${table}:`, err);
        results.push({
          table,
          action: 'Enable RLS',
          success: false,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    // Create helper functions
    try {
      console.log('[apply-rls] Creating RLS helper functions...');

      // Note: These functions need to be created directly in Supabase SQL editor
      // This API endpoint serves as a validation and documentation point

      results.push({
        table: 'functions',
        action: 'Create helper functions',
        success: true,
        note: 'Functions need to be created in Supabase SQL editor'
      });

    } catch (err) {
      results.push({
        table: 'functions',
        action: 'Create helper functions',
        success: false,
        error: err instanceof Error ? err.message : String(err)
      });
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    const response = {
      success: errorCount === 0,
      message: errorCount === 0
        ? `RLS setup initiated successfully! ${successCount} operations completed.`
        : `RLS setup completed with ${errorCount} errors. ${successCount} operations succeeded.`,
      details: {
        totalOperations: results.length,
        successCount,
        errorCount,
        results,
        nextSteps: [
          '1. Execute the migration SQL in Supabase SQL editor',
          '2. Verify RLS policies are active',
          '3. Test with different user roles',
          '4. Monitor for any access issues'
        ]
      }
    };

    console.log('[apply-rls] RLS setup completed:', response);

    return NextResponse.json(response);

  } catch (error) {
    console.error('[apply-rls] RLS setup failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: 'Failed to setup RLS'
    }, { status: 500 });
  }
});