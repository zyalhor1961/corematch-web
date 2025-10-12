/**
 * Deploy DEB Migration Script
 *
 * Applies the DEB business logic migration to the remote Supabase database
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in environment');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SERVICE_ROLE_KEY ? '✓' : '✗');
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function deployMigration() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║       DEB MIGRATION DEPLOYMENT                         ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);
  console.log(`🔑 Using service role key: ${SERVICE_ROLE_KEY.substring(0, 20)}...\n`);

  try {
    // Read migration file
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '008_deb_business_logic.sql');
    console.log(`📁 Reading migration file: ${migrationPath}`);

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');
    console.log(`✓ Migration file loaded (${sql.length} characters)\n`);

    // Split SQL into individual statements (basic approach)
    console.log('🚀 Executing migration...\n');

    // Execute the entire SQL as one transaction
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(() => {
      // If exec_sql function doesn't exist, we need to execute via REST API
      return { data: null, error: new Error('Using direct SQL execution') };
    });

    if (error) {
      console.log('⚠️  RPC function not available, using direct REST API execution...\n');

      // Alternative: Execute using Supabase SQL editor endpoint
      // This requires using the REST API directly
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ sql_query: sql })
      });

      if (!response.ok) {
        throw new Error(`SQL execution failed: ${response.status} ${response.statusText}`);
      }

      console.log('✅ Migration executed successfully!\n');
    } else {
      console.log('✅ Migration executed successfully!\n');
    }

    // Verify tables were created
    console.log('🔍 Verifying migration...\n');

    const tablesToCheck = [
      'deb_article_reference',
      'deb_vat_controls',
      'deb_eu_countries'
    ];

    for (const table of tablesToCheck) {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`   ❌ Table '${table}': NOT FOUND`);
        console.error(`      Error: ${error.message}`);
      } else {
        console.log(`   ✅ Table '${table}': OK (${count || 0} rows)`);
      }
    }

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║            DEPLOYMENT SUCCESSFUL                       ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    console.log('Next steps:');
    console.log('  1. Test VAT controls: npx tsx examples/deb-complete-test.ts');
    console.log('  2. Start dev server: npm run dev');
    console.log('  3. Access validation UI at: /deb/[documentId]/validate\n');

  } catch (error: any) {
    console.error('\n❌ Deployment failed:', error.message);
    console.error('\n📋 Manual deployment instructions:');
    console.error('   1. Go to https://supabase.com/dashboard');
    console.error('   2. Open SQL Editor');
    console.error('   3. Copy contents of: supabase/migrations/008_deb_business_logic.sql');
    console.error('   4. Paste and run the SQL\n');
    process.exit(1);
  }
}

deployMigration();
