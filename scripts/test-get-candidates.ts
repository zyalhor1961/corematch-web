/**
 * Test direct de get_candidates
 */

import { getCandidates } from '../lib/mcp/server/tools/get-candidates';
import { verifyMCPApiKey } from '../lib/auth/mcp-auth';

const apiKey = 'mcp_sk_da36279d0fd737ee9596e9e2865e731220f37ddc7c67d6d4';
const projectId = '7ee1d2d9-0896-4a26-9109-a276385a3bc6';

async function test() {
  console.log('🧪 Testing get_candidates\n');
  console.log('='.repeat(60));

  // 1. Auth
  console.log('\n📝 STEP 1: Authenticate');
  const authResult = await verifyMCPApiKey(apiKey);

  if (!authResult.success) {
    console.error('❌ Auth failed:', authResult.error);
    return;
  }

  console.log('✅ Authenticated as:', authResult.user!.id);

  // 2. Call get_candidates
  console.log('\n📝 STEP 2: Call get_candidates');
  console.log('   Project ID:', projectId);

  try {
    const result = await getCandidates(
      {
        projectId,
        limit: 10,
        status: 'all',
      },
      authResult.user
    );

    console.log('\n✅ SUCCESS!');
    console.log('   Total candidates:', result.total);
    console.log('   Returned:', result.candidates.length);
    console.log('   Has more:', result.has_more);
    console.log('');
    console.log('Candidates:');
    result.candidates.forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.name} (${c.status})`);
      console.log(`      Email: ${c.email || 'N/A'}`);
      console.log(`      Score: ${c.score ?? 'N/A'}`);
      console.log(`      Consent MCP: ${c.consent_mcp ? '✅' : '❌'}`);
    });
  } catch (err: any) {
    console.error('\n❌ ERROR:', err.message);
    console.error('Stack:', err.stack);
  }
}

test().catch(console.error);
