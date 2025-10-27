/**
 * Script pour générer une API key MCP production
 * Usage: npx tsx scripts/generate-api-key.ts
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load from .env.mcp if not in environment
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const envMcpPath = join(process.cwd(), '.env.mcp');
  if (existsSync(envMcpPath)) {
    const envContent = readFileSync(envMcpPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value.trim();
        }
      }
    });
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local or .env.mcp');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function generateApiKey() {
  console.log('\n🔑 Generating MCP API Key...\n');

  try {
    // 1. Récupérer votre user_id (premier admin user)
    console.log('1️⃣  Finding your user ID...');

    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError || !users || users.users.length === 0) {
      throw new Error(`Cannot find users: ${usersError?.message || 'No users found'}`);
    }

    const userId = users.users[0].id;
    console.log(`   ✅ User ID: ${userId}\n`);

    // 2. Générer une clé aléatoire
    console.log('2️⃣  Generating random API key...');
    const apiKey = 'mcp_sk_' + randomBytes(24).toString('hex');
    console.log(`   ✅ Generated: ${apiKey.substring(0, 20)}...${apiKey.substring(apiKey.length - 6)}\n`);

    // 3. Hasher la clé (SHA-256)
    console.log('3️⃣  Hashing API key...');
    const keyHash = 'sha256_' + createHash('sha256').update(apiKey).digest('hex');
    console.log(`   ✅ Hash: ${keyHash.substring(0, 20)}...\n`);

    // 4. Insérer dans la table
    console.log('4️⃣  Inserting into database...');

    const { data: insertedKey, error: insertError } = await supabase
      .from('mcp_api_keys')
      .insert({
        user_id: userId,
        org_id: null,
        project_id: null,
        key_hash: keyHash,
        name: 'Production MCP Server',
        description: 'Clé pour serveur MCP production - CoreMatch',
        scopes: ['cv:analyze', 'cv:read', 'project:read'],
        is_active: true,
        expires_at: '2026-12-31T23:59:59Z',
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    console.log(`   ✅ Inserted with ID: ${insertedKey.id}\n`);

    // 5. Afficher le résultat
    console.log('════════════════════════════════════════════════');
    console.log('✅ API KEY GENERATED SUCCESSFULLY');
    console.log('════════════════════════════════════════════════\n');
    console.log('⚠️  COPY THIS KEY NOW - IT WILL NOT BE SHOWN AGAIN!\n');
    console.log(`   ${apiKey}\n`);
    console.log('════════════════════════════════════════════════\n');
    console.log('📋 Key Details:');
    console.log(`   ID: ${insertedKey.id}`);
    console.log(`   Name: ${insertedKey.name}`);
    console.log(`   Scopes: ${insertedKey.scopes.join(', ')}`);
    console.log(`   Expires: ${insertedKey.expires_at}`);
    console.log(`   Created: ${insertedKey.created_at}\n`);
    console.log('════════════════════════════════════════════════\n');
    console.log('📝 Next Steps:');
    console.log('1. Copy the API key above');
    console.log('2. Add to .env.production:');
    console.log(`   MCP_AUTH_HEADER=ApiKey ${apiKey}`);
    console.log('3. Continue with deployment\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

generateApiKey();
