/**
 * Vérifier un projet spécifique
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const projectId = 'f4754162-bf55-4a51-9a37-7290cfca6413';

async function check() {
  console.log('🔍 Checking project...\n');
  console.log('Project ID:', projectId);
  console.log('');

  // Essayer de récupérer le projet
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error) {
    console.error('❌ Error:', error.message);
    console.error('   Code:', error.code);
    console.error('   Details:', error.details);
    console.error('');
    console.log('💡 The project might not exist or there might be an RLS policy blocking access');
    return;
  }

  if (!project) {
    console.log('❌ Project not found');
    return;
  }

  console.log('✅ Project found!');
  console.log('   Name:', project.name);
  console.log('   Org ID:', project.org_id || 'NULL');
  console.log('   Created By:', project.created_by || 'NULL');
  console.log('   Has job_spec_config:', !!project.job_spec_config);
  console.log('');

  if (project.job_spec_config) {
    console.log('✅ Job spec is configured');
  } else {
    console.log('⚠️  WARNING: No job_spec_config');
    console.log('   analyze_cv will fail with JOB_SPEC_MISSING');
  }
}

check().catch(console.error);
