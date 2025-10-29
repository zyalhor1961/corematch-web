/**
 * Vérifier les détails d'un projet
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const projectId = 'f4754162-bf55-4a51-9a37-7290cfca6413';

async function check() {
  console.log('🔍 Checking project details...\n');

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error || !project) {
    console.error('❌ Error:', error?.message);
    return;
  }

  console.log('✅ Project:', project.name);
  console.log('');
  console.log('Job Spec Related Fields:');
  console.log('  job_spec_config (JSONB):', project.job_spec_config ? 'EXISTS' : 'NULL');
  console.log('  requirements (TEXT):', project.requirements ? 'EXISTS' : 'NULL');
  console.log('  job_title:', project.job_title || 'NULL');
  console.log('');

  if (project.job_spec_config) {
    console.log('✅ job_spec_config is configured (JSONB)');
    console.log('   Type:', typeof project.job_spec_config);
    console.log('   Keys:', Object.keys(project.job_spec_config));
    console.log('');
    console.log('Content preview:');
    console.log(JSON.stringify(project.job_spec_config, null, 2).substring(0, 500));
  } else {
    console.log('⚠️  job_spec_config is NULL');
  }

  console.log('');

  if (project.requirements) {
    console.log('Requirements (TEXT):');
    console.log(project.requirements.substring(0, 300));
  }
}

check().catch(console.error);
