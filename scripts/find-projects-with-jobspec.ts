/**
 * Trouver les projets avec job_spec_config configuré
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const orgId = '75322f8c-4741-4e56-a973-92d68a261e4e';

async function find() {
  console.log('🔍 Finding projects with job_spec_config...\n');

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name, job_spec_config, org_id')
    .eq('org_id', orgId);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  const withJobSpec = projects.filter(p => p.job_spec_config !== null && p.job_spec_config !== undefined);

  console.log('Total projects:', projects.length);
  console.log('With job_spec_config:', withJobSpec.length);
  console.log('');

  if (withJobSpec.length > 0) {
    console.log('✅ Projects with structured job spec:');
    withJobSpec.forEach(p => {
      console.log(`   - ${p.name}`);
      console.log(`     ID: ${p.id}`);
      console.log('');
    });
  } else {
    console.log('⚠️  No projects with job_spec_config found');
    console.log('');
    console.log('💡 Solutions:');
    console.log('   1. Configure job_spec_config for an existing project via the web UI');
    console.log('   2. Or use Mode MOCK to test analyze_cv');
  }
}

find().catch(console.error);
