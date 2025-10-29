/**
 * Script de debug pour vérifier l'API key dans la DB
 */

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const apiKey = 'mcp_sk_da36279d0fd737ee9596e9e2865e731220f37ddc7c67d6d4';

// Hash l'API key de la même manière que le code
function hashApiKey(key: string): string {
  const hash = createHash('sha256').update(key).digest('hex');
  return `sha256_${hash}`;
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  console.log('🔍 Debugging API Key...\n');
  console.log('API Key:', apiKey);

  const keyHash = hashApiKey(apiKey);
  console.log('Hash:', keyHash);
  console.log('');

  // 1. Vérifier si la clé existe
  console.log('1. Checking if key exists in DB...');
  const { data: key, error } = await supabase
    .from('mcp_api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .single();

  if (error) {
    console.error('❌ Error:', error.message);
    console.error('Code:', error.code);
  } else if (key) {
    console.log('✅ Key found!');
    console.log('   ID:', key.id);
    console.log('   Name:', key.name);
    console.log('   User ID:', key.user_id);
    console.log('   Is Active:', key.is_active);
    console.log('   Scopes:', key.scopes);
    console.log('   Expires:', key.expires_at);
  } else {
    console.log('❌ Key not found');
  }

  console.log('');

  // 2. Lister toutes les clés
  console.log('2. Listing all API keys...');
  const { data: allKeys } = await supabase
    .from('mcp_api_keys')
    .select('id, name, key_hash, is_active, created_at')
    .limit(5);

  if (allKeys && allKeys.length > 0) {
    console.log(`Found ${allKeys.length} keys:`);
    allKeys.forEach((k) => {
      console.log(`   - ${k.name} (${k.is_active ? 'active' : 'inactive'})`);
      console.log(`     Hash: ${k.key_hash.substring(0, 30)}...`);
    });
  } else {
    console.log('No keys found');
  }
}

debug().catch(console.error);
