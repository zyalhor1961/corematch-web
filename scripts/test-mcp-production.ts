/**
 * Script de test du serveur MCP en mode production
 * Usage: npx tsx scripts/test-mcp-production.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testProduction() {
  console.log('\n🧪 Testing MCP Production Setup...\n');
  console.log(`📍 Database: ${supabaseUrl}\n`);

  try {
    // 1. Vérifier les candidats avec consent
    console.log('1️⃣  Checking candidates with MCP consent...');

    const { data: candidates, error: candidatesError } = await supabase
      .from('candidates')
      .select('id, first_name, last_name, project_id, cv_text, consent_mcp')
      .eq('consent_mcp', true)
      .limit(5);

    if (candidatesError || !candidates || candidates.length === 0) {
      throw new Error('No candidates found with consent and CV');
    }

    console.log(`   ✅ Found ${candidates.length} candidates with consent\n`);

    candidates.forEach((c, i) => {
      const name = c.last_name ? `${c.first_name} ${c.last_name}` : c.first_name;
      const cvLength = c.cv_text?.length || 0;
      console.log(`   ${i + 1}. ${name}`);
      console.log(`      ID: ${c.id}`);
      console.log(`      Project: ${c.project_id}`);
      console.log(`      CV Length: ${cvLength} chars`);
      console.log(`      Consent: ${c.consent_mcp ? '✅' : '❌'}\n`);
    });

    // 2. Vérifier un projet
    const testProjectId = candidates[0].project_id;
    console.log(`2️⃣  Checking project ${testProjectId}...\n`);

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, title, job_spec, pii_masking_level')
      .eq('id', testProjectId)
      .single();

    if (projectError || !project) {
      throw new Error(`Project not found: ${projectError?.message}`);
    }

    console.log(`   ✅ Project: ${project.title}`);
    console.log(`   PII Masking: ${project.pii_masking_level || 'none'}`);
    console.log(`   Has JobSpec: ${project.job_spec ? '✅' : '❌'}\n`);

    // 3. Afficher les commandes de test
    console.log('════════════════════════════════════════════════');
    console.log('✅ Production Setup Verified!');
    console.log('════════════════════════════════════════════════\n');
    console.log('📋 Next Steps: Test with MCP Inspector\n');
    console.log('1. Load environment variables:');
    console.log('   (Windows PowerShell)');
    console.log('   Get-Content .env.production | ForEach-Object { if ($_ -match \'^([^=]+)=(.*)$\') { [Environment]::SetEnvironmentVariable($matches[1].Trim(\'"\'), $matches[2].Trim(\'"\')) } }\n');
    console.log('2. Start MCP Inspector:');
    console.log('   npx @modelcontextprotocol/inspector npm run mcp:server\n');
    console.log('3. Test get_candidates:');
    console.log('   Tool: get_candidates');
    console.log('   Arguments:');
    console.log(`   {`);
    console.log(`     "projectId": "${testProjectId}",`);
    console.log(`     "limit": 5`);
    console.log(`   }\n`);
    console.log('4. Test analyze_cv:');
    console.log('   Tool: analyze_cv');
    console.log('   Arguments:');
    console.log(`   {`);
    console.log(`     "candidateId": "${candidates[0].id}",`);
    console.log(`     "projectId": "${testProjectId}",`);
    console.log(`     "mode": "balanced"`);
    console.log(`   }\n`);
    console.log('════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testProduction();
