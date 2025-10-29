/**
 * Script pour appliquer la migration MCP RGPD
 *
 * Usage: npx tsx scripts/apply-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load env
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

async function applyMigration() {
  console.log('🚀 Applying migration 010_mcp_rgpd_fields.sql...\n');

  // Create admin client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Read migration file
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '010_mcp_rgpd_fields.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

  console.log('📄 Migration file loaded');
  console.log(`   Path: ${migrationPath}`);
  console.log(`   Size: ${migrationSQL.length} bytes\n`);

  // Split migration into individual statements
  // Note: Simple split, real-world would need better parsing
  const statements = migrationSQL
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--') && !s.startsWith('/**'));

  console.log(`📋 Found ${statements.length} SQL statements\n`);

  let successCount = 0;
  let errorCount = 0;

  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    // Skip comments and documentation blocks
    if (statement.startsWith('COMMENT ON') || statement.includes('Migration 010')) {
      continue;
    }

    console.log(`⚙️  [${i + 1}/${statements.length}] Executing...`);

    try {
      // Use rpc to execute raw SQL (if available) or use query
      const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' }).throwOnError();

      if (error) {
        throw error;
      }

      successCount++;
      console.log(`   ✅ Success\n`);
    } catch (error: any) {
      // Some errors are expected (e.g., column already exists)
      if (
        error.message?.includes('already exists') ||
        error.message?.includes('IF NOT EXISTS')
      ) {
        console.log(`   ⚠️  Already exists (skipped)\n`);
        successCount++;
      } else {
        console.error(`   ❌ Error: ${error.message}\n`);
        errorCount++;
      }
    }
  }

  console.log('═══════════════════════════════════════════════');
  console.log(`✅ Migration completed`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log('═══════════════════════════════════════════════\n');

  if (errorCount === 0) {
    console.log('✨ All migrations applied successfully!');
    process.exit(0);
  } else {
    console.log('⚠️  Some migrations failed. Check errors above.');
    process.exit(1);
  }
}

applyMigration().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
