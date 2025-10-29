import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const userId = '86e4badc-cd84-4113-a768-fbd61804ff48';
const projectId = '037e7639-3d42-45f1-86c2-1f21a72fb96a';

async function check() {
  console.log('🔍 Checking Project Access...\n');

  // 1. Vérifier le projet
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (projectError) {
    console.error('❌ Project not found:', projectError.message);
    return;
  }

  console.log('✅ Project found:');
  console.log('   ID:', project.id);
  console.log('   Name:', project.name || 'N/A');
  console.log('   Created By:', project.created_by || 'NULL');
  console.log('   Org ID:', project.org_id || 'NULL');
  console.log('');

  // 2. Si le projet a un org_id, vérifier le membership
  if (project.org_id) {
    console.log('🔍 Checking membership in org', project.org_id);

    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('*')
      .eq('org_id', project.org_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (membershipError) {
      console.error('❌ Membership check error:', membershipError.message);
    } else if (membership) {
      console.log('✅ User IS a member');
      console.log('   Role:', membership.role);
      console.log('');
      console.log('✅ ACCESS SHOULD BE GRANTED');
    } else {
      console.log('❌ User is NOT a member of this organization');
      console.log('');
      console.log('💡 SOLUTION: Add user to organization');
      console.log('');
      console.log('Run this SQL in Supabase SQL Editor:');
      console.log('');
      console.log(`INSERT INTO organization_members (org_id, user_id, role)`);
      console.log(`VALUES ('${project.org_id}', '${userId}', 'admin');`);
    }
  } else if (project.created_by) {
    console.log('🔍 Checking created_by match');
    if (project.created_by === userId) {
      console.log('✅ Project belongs to user');
      console.log('✅ ACCESS SHOULD BE GRANTED');
    } else {
      console.log('❌ Project does NOT belong to user');
      console.log(`   Expected: ${userId}`);
      console.log(`   Got: ${project.created_by}`);
    }
  } else {
    console.log('❌ Project has no org_id and no created_by');
    console.log('   This project is orphaned - access will be denied');
  }
}

check().catch(console.error);
