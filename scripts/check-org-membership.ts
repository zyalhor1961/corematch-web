/**
 * Vérifier le membership de l'utilisateur dans l'organisation
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

const userId = '86e4badc-cd84-4113-a768-fbd61804ff48';
const orgId = '75322f8c-4741-4e56-a973-92d68a261e4e';

async function check() {
  console.log('🔍 Checking Organization Membership...\n');
  console.log('User ID:', userId);
  console.log('Org ID:', orgId);
  console.log('');

  // Vérifier membership
  const { data: membership, error } = await supabase
    .from('organization_members')
    .select('*')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (membership) {
    console.log('✅ User IS a member of this organization');
    console.log('   Role:', membership.role);
    console.log('   Joined:', membership.created_at);
  } else {
    console.log('❌ User is NOT a member of this organization');
    console.log('');
    console.log('💡 SOLUTION: Add user to organization');
    console.log('');
    console.log('Run this SQL in Supabase SQL Editor:');
    console.log('');
    console.log(`INSERT INTO organization_members (org_id, user_id, role)`);
    console.log(`VALUES ('${orgId}', '${userId}', 'admin');`);
  }
}

check().catch(console.error);
