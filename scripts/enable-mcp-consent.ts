/**
 * Script pour activer le consent MCP sur les candidats
 * Usage: npx tsx scripts/enable-mcp-consent.ts [--all | --project PROJECT_ID]
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function enableConsent() {
  console.log('\n🔐 Activating MCP Consent for Candidates...\n');

  const args = process.argv.slice(2);
  const isAll = args.includes('--all');
  const projectIdIndex = args.indexOf('--project');
  const projectId = projectIdIndex >= 0 ? args[projectIdIndex + 1] : null;

  try {
    if (!isAll && !projectId) {
      // Mode interactif : afficher les projets disponibles
      console.log('📋 Available Projects:\n');

      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (projectsError || !projects || projects.length === 0) {
        throw new Error('No projects found');
      }

      projects.forEach((project, index) => {
        console.log(`   ${index + 1}. ${project.title}`);
        console.log(`      ID: ${project.id}`);
        console.log(`      Created: ${new Date(project.created_at).toLocaleDateString()}\n`);
      });

      console.log('Usage:');
      console.log('  - Enable for ALL candidates: npm run enable-consent -- --all');
      console.log('  - Enable for ONE project: npm run enable-consent -- --project PROJECT_ID\n');
      return;
    }

    // Activer consent
    let query = supabase.from('candidates').update({
      consent_mcp: true,
    });

    if (projectId) {
      console.log(`🎯 Target: Project ${projectId}\n`);
      query = query.eq('project_id', projectId);
    } else {
      console.log('🌐 Target: ALL candidates\n');
    }

    console.log('⚙️  Updating candidates...');

    const { data, error, count } = await query.select();

    if (error) {
      throw error;
    }

    console.log(`✅ Updated ${data?.length || 0} candidates\n`);

    // Vérification
    console.log('🔍 Verification:\n');

    const { data: verification, error: verifyError } = await supabase
      .from('candidates')
      .select('id, first_name, last_name, consent_mcp')
      .eq('consent_mcp', true)
      .limit(5);

    if (verifyError) {
      throw verifyError;
    }

    console.log(`   Total candidates with MCP consent: ${verification?.length || 0}\n`);

    if (verification && verification.length > 0) {
      console.log('   Sample candidates:');
      verification.forEach((c) => {
        console.log(`   - ${c.first_name} ${c.last_name} (consent_mcp: ✅)`);
      });
      console.log('');
    }

    console.log('════════════════════════════════════════════════');
    console.log('✅ MCP Consent Activated Successfully!');
    console.log('════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

enableConsent();
