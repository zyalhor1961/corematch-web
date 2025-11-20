/**
 * Apply Admin Phase 1 Migrations
 *
 * Applies database schema directly using Supabase service role key
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Please set these in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function executeSQL(sql: string, description: string): Promise<boolean> {
  console.log(`\n📝 Executing: ${description}`);
  console.log(`   SQL length: ${sql.length} characters`);

  try {
    // Split SQL into individual statements (rough split by semicolons outside strings)
    // For complex migrations, we'll just execute the whole file
    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      // If exec_sql function doesn't exist, we need to create it first
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        console.log('   ⚠️  exec_sql function not found. Creating it first...');

        // Create exec_sql function
        const createFunctionSQL = `
          CREATE OR REPLACE FUNCTION exec_sql(sql text)
          RETURNS jsonb
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          DECLARE
            result jsonb;
          BEGIN
            EXECUTE sql;
            result := jsonb_build_object('success', true);
            RETURN result;
          EXCEPTION WHEN OTHERS THEN
            result := jsonb_build_object('error', SQLERRM);
            RETURN result;
          END;
          $$;
        `;

        // Try to create the function using raw query
        const {error: createError } = await supabase.rpc('exec_sql', { sql: createFunctionSQL });

        if (createError) {
          console.error('   ❌ Cannot create exec_sql function. Please apply migrations manually.');
          console.error('   Error:', createError.message);
          return false;
        }

        // Retry original SQL
        const { data: retryData, error: retryError } = await supabase.rpc('exec_sql', { sql });

        if (retryError) {
          console.error('   ❌ Failed:', retryError.message);
          return false;
        }

        console.log('   ✅ Success');
        return true;
      }

      console.error('   ❌ Failed:', error.message);
      return false;
    }

    console.log('   ✅ Success');
    return true;
  } catch (error: any) {
    console.error('   ❌ Error:', error.message);
    return false;
  }
}

async function applyMigrations() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       ADMIN PHASE 1 MIGRATIONS - DIRECT APPLICATION        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('⚙️  Configuration:');
  console.log(`   Supabase URL: ${supabaseUrl}`);
  console.log(`   Service Key: ${supabaseServiceKey ? '✓ Present' : '✗ Missing'}\n`);

  const migrations = [
    {
      file: path.resolve(process.cwd(), 'supabase/migrations/20250120_admin_phase1_graphs.sql'),
      description: 'Graph Management Schema (tables + seed data)',
    },
    {
      file: path.resolve(process.cwd(), 'supabase/migrations/20250120_admin_phase1_rls.sql'),
      description: 'Row-Level Security Policies',
    },
  ];

  console.log(`📋 Migrations to apply: ${migrations.length}\n`);

  let allSuccess = true;

  for (const migration of migrations) {
    console.log(`${'═'.repeat(60)}`);

    if (!fs.existsSync(migration.file)) {
      console.error(`❌ File not found: ${migration.file}`);
      allSuccess = false;
      continue;
    }

    const sql = fs.readFileSync(migration.file, 'utf-8');
    const success = await executeSQL(sql, migration.description);

    if (!success) {
      allSuccess = false;
      console.log(`\n⚠️  Migration failed. Manual application required:`);
      console.log(`   1. Go to: https://supabase.com/dashboard/project/_/sql/new`);
      console.log(`   2. Copy-paste SQL from: ${migration.file}`);
      console.log(`   3. Click "Run"\n`);
    }
  }

  console.log(`\n${'═'.repeat(60)}`);

  if (allSuccess) {
    console.log('✅ ALL MIGRATIONS APPLIED SUCCESSFULLY!\n');
    console.log('Next steps:');
    console.log('   1. Verify tables: Check Supabase Dashboard > Table Editor');
    console.log('   2. Verify RLS: Check Supabase Dashboard > Authentication > Policies');
    console.log('   3. Build API routes: Create /api/admin/graphs endpoints');
    console.log('   4. Build UI: Create /admin/graphs pages\n');
  } else {
    console.log('⚠️  SOME MIGRATIONS FAILED\n');
    console.log('Common issues:');
    console.log('   - exec_sql function not available (apply manually via Dashboard)');
    console.log('   - Syntax errors in SQL (check migration files)');
    console.log('   - Permission issues (verify SUPABASE_SERVICE_ROLE_KEY)\n');
    console.log('Recommended: Apply migrations manually via Supabase Dashboard SQL Editor.\n');
  }

  return allSuccess;
}

// Run
applyMigrations()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
  });
