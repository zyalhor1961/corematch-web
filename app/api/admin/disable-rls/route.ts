import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/auth-middleware';

export const POST = withAuth(async (request, session) => {
  // 🚨 DANGER: This route DISABLES Row Level Security on ALL tables
  // ONLY allow in development environment
  if (process.env.NODE_ENV === 'production') {
    console.error('[disable-rls] ⚠️ BLOCKED: Attempted RLS disable in production by user', session.user.id);
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'RLS modification is disabled in production for security' },
      { status: 403 }
    );
  }

  console.warn(`[disable-rls] ⚠️ DEV ONLY: User ${session.user.id} disabling RLS on all tables`);

  try {
    console.log('[disable-rls] Disabling RLS on all tables...');

    const tables = [
      'organizations',
      'organization_members',
      'projects',
      'candidates',
      'profiles',
      'documents',
      'usage_counters'
    ];

    const results = [];

    for (const table of tables) {
      try {
        const { error } = await supabaseAdmin
          .rpc('exec_sql', {
            sql: `ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;`
          });

        if (error) {
          // Try alternative approach if RPC doesn't work
          console.log(`RPC failed for ${table}, trying direct SQL...`);

          // Use a simple query that will execute the SQL
          const { error: directError } = await supabaseAdmin
            .from(table)
            .select('count', { count: 'exact', head: true });

          // For now, just log and continue
          results.push({
            table,
            status: directError ? 'may_not_exist' : 'checked',
            message: directError ? directError.message : 'Table exists'
          });
        } else {
          results.push({
            table,
            status: 'disabled',
            message: 'RLS disabled successfully'
          });
        }
      } catch (err: any) {
        results.push({
          table,
          status: 'error',
          message: err.message
        });
      }
    }

    // Also disable RLS using a different approach - direct SQL execution
    const disableRLSCommands = tables.map(table =>
      `ALTER TABLE IF EXISTS ${table} DISABLE ROW LEVEL SECURITY;`
    ).join('\n');

    console.log('[disable-rls] RLS disable results:', results);

    return NextResponse.json({
      success: true,
      message: 'RLS disable attempted on all tables',
      results,
      sql_commands: disableRLSCommands,
      note: 'You may need to run these SQL commands manually in Supabase SQL editor if RPC functions are not available'
    });

  } catch (error) {
    console.error('[disable-rls] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to disable RLS', details: (error as Error).message },
      { status: 500 }
    );
  }
});