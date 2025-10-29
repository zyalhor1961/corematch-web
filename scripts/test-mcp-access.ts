/**
 * Test de l'accès MCP - Simule exactement ce qui se passe dans get_candidates
 */

import { createClient } from '@supabase/supabase-js';
import { verifyMCPApiKey, verifyMCPProjectAccess, type MCPAuthUser } from '../lib/auth/mcp-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// Valeurs connues
const apiKey = 'mcp_sk_da36279d0fd737ee9596e9e2865e731220f37ddc7c67d6d4';
const projectId = '7ee1d2d9-0896-4a26-9109-a276385a3bc6';
const expectedUserId = '86e4badc-cd84-4113-a768-fbd61804ff48';
const expectedOrgId = '75322f8c-4741-4e56-a973-92d68a261e4e';

async function test() {
  console.log('🧪 Testing MCP Access Flow\n');
  console.log('='.repeat(60));

  // =========================================================================
  // ÉTAPE 1: Vérifier l'API Key
  // =========================================================================

  console.log('\n📝 STEP 1: Verify API Key');
  console.log('-'.repeat(60));

  const authResult = await verifyMCPApiKey(apiKey);

  if (!authResult.success) {
    console.error('❌ API Key verification failed:', authResult.error);
    return;
  }

  console.log('✅ API Key verified successfully');
  console.log('   User ID:', authResult.user!.id);
  console.log('   Type:', authResult.user!.type);
  console.log('   Org ID:', authResult.user!.org_id || 'NULL');
  console.log('   Project ID:', authResult.user!.project_id || 'NULL');
  console.log('   Scopes:', authResult.user!.scopes);

  const authUser = authResult.user!;

  // Vérifier que le user_id est le bon
  if (authUser.id !== expectedUserId) {
    console.error(`⚠️  WARNING: User ID mismatch!`);
    console.error(`   Expected: ${expectedUserId}`);
    console.error(`   Got:      ${authUser.id}`);
  }

  // =========================================================================
  // ÉTAPE 2: Vérifier le Projet
  // =========================================================================

  console.log('\n📝 STEP 2: Check Project Details');
  console.log('-'.repeat(60));

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, created_by, org_id')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    console.error('❌ Project not found:', projectError?.message);
    return;
  }

  console.log('✅ Project found:');
  console.log('   ID:', project.id);
  console.log('   Created By:', project.created_by || 'NULL');
  console.log('   Org ID:', project.org_id || 'NULL');

  // =========================================================================
  // ÉTAPE 3: Vérifier le Membership
  // =========================================================================

  console.log('\n📝 STEP 3: Check Organization Membership');
  console.log('-'.repeat(60));

  if (!project.org_id) {
    console.log('⚠️  Project has no org_id');
  } else {
    console.log(`🔍 Looking for membership:`);
    console.log(`   org_id = ${project.org_id}`);
    console.log(`   user_id = ${authUser.id}`);

    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('*')
      .eq('org_id', project.org_id)
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (membershipError) {
      console.error('❌ Membership query error:', membershipError.message);
    } else if (membership) {
      console.log('✅ Membership found:');
      console.log('   ID:', membership.id);
      console.log('   Role:', membership.role);
      console.log('   Created At:', membership.created_at);
    } else {
      console.log('❌ NO membership found!');
      console.log('');
      console.log('💡 DEBUGGING: List all memberships for this user...');

      const { data: allMemberships } = await supabase
        .from('organization_members')
        .select('*')
        .eq('user_id', authUser.id);

      if (allMemberships && allMemberships.length > 0) {
        console.log(`   Found ${allMemberships.length} memberships:`);
        allMemberships.forEach((m: any) => {
          console.log(`   - Org: ${m.org_id}, Role: ${m.role}`);
        });
      } else {
        console.log('   User has NO memberships at all!');
      }

      console.log('');
      console.log('💡 DEBUGGING: List all memberships for this org...');

      const { data: orgMemberships } = await supabase
        .from('organization_members')
        .select('*')
        .eq('org_id', project.org_id);

      if (orgMemberships && orgMemberships.length > 0) {
        console.log(`   Found ${orgMemberships.length} members in org:`);
        orgMemberships.forEach((m: any) => {
          console.log(`   - User: ${m.user_id}, Role: ${m.role}`);
        });
      } else {
        console.log('   Org has NO members!');
      }
    }
  }

  // =========================================================================
  // ÉTAPE 4: Tester verifyMCPProjectAccess
  // =========================================================================

  console.log('\n📝 STEP 4: Test verifyMCPProjectAccess Function');
  console.log('-'.repeat(60));

  console.log('🔍 Calling verifyMCPProjectAccess...');
  console.log('   (Check logs above for detailed trace)');
  console.log('');

  const hasAccess = await verifyMCPProjectAccess(authUser, projectId);

  console.log('');
  if (hasAccess) {
    console.log('✅ ACCESS GRANTED');
  } else {
    console.log('❌ ACCESS DENIED');
  }

  // =========================================================================
  // RÉSUMÉ
  // =========================================================================

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log('API Key Valid:', authResult.success ? '✅' : '❌');
  console.log('Project Found:', project ? '✅' : '❌');
  console.log('Project Has Org:', project?.org_id ? '✅' : '❌');
  console.log('Final Access:', hasAccess ? '✅ GRANTED' : '❌ DENIED');
  console.log('='.repeat(60));
}

test().catch(console.error);
