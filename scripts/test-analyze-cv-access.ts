/**
 * Test de l'accès analyze_cv (sans analyser réellement le CV)
 */

import { verifyMCPApiKey, verifyMCPProjectAccess } from '../lib/auth/mcp-auth';

const apiKey = 'mcp_sk_da36279d0fd737ee9596e9e2865e731220f37ddc7c67d6d4';
const candidateId = '06b6f7dd-efef-4071-b684-33fe155a7532';
const projectId = '037e7639-3d42-45f1-86c2-1f21a72fb96a';

async function test() {
  console.log('🧪 Testing analyze_cv Access Control\n');
  console.log('='.repeat(60));

  // 1. Auth
  console.log('\n📝 STEP 1: Authenticate');
  const authResult = await verifyMCPApiKey(apiKey);

  if (!authResult.success) {
    console.error('❌ Auth failed:', authResult.error);
    return;
  }

  console.log('✅ Authenticated as:', authResult.user!.id);
  console.log('   Type:', authResult.user!.type);
  console.log('   Org ID:', authResult.user!.org_id || 'NULL');
  console.log('   Project ID:', authResult.user!.project_id || 'NULL');

  // 2. Vérifier accès au projet
  console.log('\n📝 STEP 2: Check Project Access');
  console.log('   Project ID:', projectId);

  const hasAccess = await verifyMCPProjectAccess(authResult.user!, projectId);

  if (hasAccess) {
    console.log('\n✅ ACCESS GRANTED!');
    console.log('   The user has access to this project');
    console.log('');
    console.log('💡 Next step: Check if candidate has CV uploaded');
  } else {
    console.log('\n❌ ACCESS DENIED!');
    console.log('   The user does NOT have access to this project');
    console.log('');
    console.log('💡 This should not happen - check the logs above');
  }
}

test().catch(console.error);
