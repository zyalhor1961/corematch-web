/**
 * Script pour vérifier si la migration MCP RGPD a été appliquée
 *
 * Usage: npx tsx scripts/check-migration.ts
 */

import { createClient } from '@supabase/supabase-js';

// Load env (assuming .env.local is loaded by tsx/dotenv)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Make sure .env.local is loaded');
  process.exit(1);
}

async function checkMigration() {
  console.log('🔍 Checking migration status...\n');
  console.log(`📡 Supabase URL: ${SUPABASE_URL}`);

  // Create admin client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const checks = [
    {
      name: 'candidates.consent_mcp column',
      check: async () => {
        const { data, error } = await supabase
          .from('candidates')
          .select('consent_mcp')
          .limit(0);
        return !error;
      },
    },
    {
      name: 'projects.pii_masking_level column',
      check: async () => {
        const { data, error } = await supabase
          .from('projects')
          .select('pii_masking_level')
          .limit(0);
        return !error;
      },
    },
    {
      name: 'mcp_audit_logs table',
      check: async () => {
        const { data, error } = await supabase
          .from('mcp_audit_logs')
          .select('id')
          .limit(0);
        return !error;
      },
    },
    {
      name: 'mcp_sessions table',
      check: async () => {
        const { data, error } = await supabase
          .from('mcp_sessions')
          .select('id')
          .limit(0);
        return !error;
      },
    },
  ];

  let allPassed = true;

  for (const { name, check } of checks) {
    try {
      const passed = await check();
      if (passed) {
        console.log(`✅ ${name}`);
      } else {
        console.log(`❌ ${name}`);
        allPassed = false;
      }
    } catch (error: any) {
      console.log(`❌ ${name} - Error: ${error.message}`);
      allPassed = false;
    }
  }

  console.log('\n═══════════════════════════════════════════════');
  if (allPassed) {
    console.log('✅ Migration 010_mcp_rgpd_fields.sql is APPLIED');
  } else {
    console.log('❌ Migration NOT applied or incomplete');
    console.log('\n📝 To apply manually:');
    console.log('   1. Go to Supabase Dashboard → SQL Editor');
    console.log('   2. Copy content from supabase/migrations/010_mcp_rgpd_fields.sql');
    console.log('   3. Run the SQL');
    console.log('\n   Or use: npx supabase db push (requires login)');
  }
  console.log('═══════════════════════════════════════════════\n');

  process.exit(allPassed ? 0 : 1);
}

checkMigration().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
