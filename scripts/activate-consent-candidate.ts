/**
 * Activer consent MCP pour un candidat spécifique
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const candidateId = 'dcab7beb-525f-468f-9db8-b246942f1e39';

async function activate() {
  console.log('🔧 Activating MCP consent...\n');
  console.log('Candidate ID:', candidateId);

  // Mettre à jour le candidat
  const { data, error } = await supabase
    .from('candidates')
    .update({ consent_mcp: true })
    .eq('id', candidateId)
    .select('id, first_name, last_name, consent_mcp');

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log('\n✅ Consent activated!');
    console.log('   Name:', data[0].first_name, data[0].last_name);
    console.log('   Consent MCP:', data[0].consent_mcp);
    console.log('');
    console.log('💡 You can now test analyze_cv with this candidate');
  } else {
    console.log('❌ Candidate not found');
  }
}

activate().catch(console.error);
