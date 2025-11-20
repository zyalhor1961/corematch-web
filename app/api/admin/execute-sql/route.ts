import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/auth-middleware';

export const POST = withAuth(async (request, session) => {
  // 🚨 DANGER: This route allows ARBITRARY SQL execution
  // ONLY allow in development environment
  if (process.env.NODE_ENV === 'production') {
    console.error('[execute-sql] ⚠️ BLOCKED: Attempted SQL execution in production by user', session.user.id);
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'SQL execution is disabled in production for security' },
      { status: 403 }
    );
  }

  console.warn(`[execute-sql] ⚠️ DEV ONLY: User ${session.user.id} executing arbitrary SQL`);

  try {
    const supabaseAdmin = await getSupabaseAdmin();
    const { sql } = await request.json();

    if (!sql) {
      return NextResponse.json(
        { error: 'SQL query is required' },
        { status: 400 }
      );
    }

    console.log('[execute-sql] Executing SQL:', sql.substring(0, 100));

    // Execute the SQL directly using the admin client
    const { data, error } = await supabaseAdmin
      .rpc('exec_sql', { sql });

    if (error) {
      console.error('[execute-sql] SQL execution error:', error);
      return NextResponse.json(
        { error: 'SQL execution failed', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result: data,
      message: 'SQL executed successfully'
    });

  } catch (error) {
    console.error('[execute-sql] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
});