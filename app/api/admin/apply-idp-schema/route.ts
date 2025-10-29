import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth-middleware';
import fs from 'fs';
import path from 'path';

export const maxDuration = 60;

export const POST = withAuth(async (request, session) => {
  if (process.env.NODE_ENV === 'production') {
    console.error('[apply-idp-schema] ⚠️ BLOCKED: Attempted access in production by user', session.user.id);
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'This route is disabled in production for security' },
      { status: 403 }
    );
  }

  console.warn(`[apply-idp-schema] ⚠️ DEV ONLY: User ${session.user.id} accessing dev route`);

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase credentials' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Read migration file
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '007_idp_module.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('[apply-idp-schema] Applying IDP migration...');

    // Split SQL into individual statements and execute them
    // Remove BEGIN/COMMIT and split by semicolon
    const cleanSql = sql
      .replace(/^BEGIN;/gm, '')
      .replace(/^COMMIT;/gm, '')
      .trim();

    const statements = cleanSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    const results: any[] = [];
    const errors: any[] = [];

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';

      try {
        console.log(`[apply-idp-schema] Executing statement ${i + 1}/${statements.length}`);

        const { data, error } = await supabase.rpc('exec_sql', {
          sql_query: statement
        });

        if (error) {
          console.error(`[apply-idp-schema] Error in statement ${i + 1}:`, error);
          errors.push({
            statement: i + 1,
            preview: statement.substring(0, 100),
            error: error.message
          });
        } else {
          results.push({
            statement: i + 1,
            success: true
          });
        }
      } catch (err: any) {
        console.error(`[apply-idp-schema] Exception in statement ${i + 1}:`, err);
        errors.push({
          statement: i + 1,
          preview: statement.substring(0, 100),
          error: err.message
        });
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      totalStatements: statements.length,
      successCount: results.length,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      message: errors.length === 0
        ? 'IDP schema applied successfully!'
        : 'Migration completed with errors. Check the errors array for details.',
      instructions: errors.length > 0
        ? 'Some statements failed. You may need to apply the migration manually via Supabase SQL Editor.'
        : undefined
    });

  } catch (error: any) {
    console.error('[apply-idp-schema] Fatal migration error:', error);
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error.message,
        instructions: [
          '1. Go to Supabase Dashboard > SQL Editor',
          '2. Open supabase/migrations/007_idp_module.sql',
          '3. Copy and paste the entire contents',
          '4. Run the SQL script'
        ]
      },
      { status: 500 }
    );
  }
});
