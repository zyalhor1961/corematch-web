/**
 * Script de debug pour vérifier l'accès au projet
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// API Key user_id
const apiKeyUserId = '86e4badc-cd84-4113-a768-fbd61804ff48';

// Projet à tester
const projectId = '7ee1d2d9-0896-4a26-9109-a276385a3bc6';

async function debug() {
  console.log('🔍 Debugging Project Access...\n');
  console.log('API Key User ID:', apiKeyUserId);
  console.log('Project ID:', projectId);
  console.log('');

  // 1. Vérifier le projet
  console.log('1. Checking project...');
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (projectError) {
    console.error('❌ Error:', projectError.message);
  } else if (project) {
    console.log('✅ Project found:');
    console.log('   ID:', project.id);
    console.log('   Created By:', project.created_by);
    console.log('   Org ID:', project.org_id || 'NULL');
    console.log('   Job Spec:', project.job_spec ? 'Present' : 'Missing');
    console.log('');

    // Comparer
    if (project.created_by === apiKeyUserId) {
      console.log('✅ MATCH: Project belongs to API key user');
    } else {
      console.log('❌ MISMATCH: Project does NOT belong to API key user');
      console.log(`   Expected: ${apiKeyUserId}`);
      console.log(`   Got: ${project.created_by}`);
    }
  } else {
    console.log('❌ Project not found');
  }

  console.log('');

  // 2. Lister les projets de cet utilisateur
  console.log('2. Listing projects for API key user...');
  const { data: userProjects, error: userProjectsError } = await supabase
    .from('projects')
    .select('id, created_at')
    .eq('created_by', apiKeyUserId)
    .limit(5);

  if (userProjectsError) {
    console.error('❌ Error:', userProjectsError.message);
  } else if (userProjects && userProjects.length > 0) {
    console.log(`✅ Found ${userProjects.length} projects:`);
    userProjects.forEach((p) => {
      console.log(`   - ID: ${p.id}`);
    });
  } else {
    console.log('⚠️  No projects found for this user');
  }

  console.log('');

  // 3. Vérifier l'utilisateur
  console.log('3. Checking user...');
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(apiKeyUserId);

  if (userError) {
    console.error('❌ Error:', userError.message);
  } else if (userData.user) {
    console.log('✅ User found:');
    console.log('   Email:', userData.user.email);
    console.log('   ID:', userData.user.id);
  } else {
    console.log('❌ User not found');
  }
}

debug().catch(console.error);
