/**
 * Script pour vérifier l'état des migrations MCP dans la DB production
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMigrations() {
  console.log('\n🔍 Checking MCP migrations status...\n');
  console.log(`📍 Database: ${supabaseUrl}\n`);

  let needsMigration = false;

  // 1. Vérifier colonne consent_mcp dans candidates
  console.log('1️⃣  Checking consent_mcp column in candidates table...');
  const { data: testCandidate, error: consentError } = await supabase
    .from('candidates')
    .select('id, consent_mcp')
    .limit(1)
    .maybeSingle();

  if (consentError) {
    if (consentError.message.includes('consent_mcp') || consentError.code === '42703') {
      console.log('   ⚠️  consent_mcp column NOT found - Migration needed');
      needsMigration = true;
    } else {
      console.log(`   ❌ Error checking candidates: ${consentError.message}`);
    }
  } else {
    console.log('   ✅ consent_mcp column exists');
  }

  // 2. Vérifier colonne pii_masking_level dans projects
  console.log('\n2️⃣  Checking pii_masking_level column in projects table...');
  const { data: testProject, error: piiError } = await supabase
    .from('projects')
    .select('id, pii_masking_level')
    .limit(1)
    .maybeSingle();

  if (piiError) {
    if (piiError.message.includes('pii_masking_level') || piiError.code === '42703') {
      console.log('   ⚠️  pii_masking_level column NOT found - Migration needed');
      needsMigration = true;
    } else {
      console.log(`   ❌ Error checking projects: ${piiError.message}`);
    }
  } else {
    console.log('   ✅ pii_masking_level column exists');
  }

  // 3. Vérifier table mcp_api_keys
  console.log('\n3️⃣  Checking mcp_api_keys table...');
  const { data: testApiKey, error: mcpTableError } = await supabase
    .from('mcp_api_keys')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (mcpTableError) {
    if (mcpTableError.code === '42P01') {
      console.log('   ⚠️  mcp_api_keys table NOT found - Migration needed');
      needsMigration = true;
    } else {
      console.log(`   ❌ Error checking mcp_api_keys: ${mcpTableError.message}`);
    }
  } else {
    console.log('   ✅ mcp_api_keys table exists');
  }

  console.log('\n════════════════════════════════════════════════');

  if (needsMigration) {
    console.log('\n⚠️  MIGRATIONS REQUIRED\n');
    console.log('Run the following SQL in Supabase SQL Editor:\n');
    console.log('1. Open https://supabase.com/dashboard/project/glexllbywdvlxpbanjmn/sql/new');
    console.log('2. Copy/paste the content of:');
    console.log('   - supabase/migrations/20250126_add_mcp_consent_columns.sql');
    console.log('   - supabase/migrations/20250126_add_mcp_api_keys_table.sql');
    console.log('3. Execute the SQL');
  } else {
    console.log('\n✅ All MCP migrations are applied!\n');
  }

  console.log('════════════════════════════════════════════════\n');
}

checkMigrations().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
