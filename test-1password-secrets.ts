/**
 * Script de test pour vérifier que les secrets 1Password sont accessibles
 */

import { getSecret, check1PasswordCLI } from './lib/secrets/1password';

async function testSecrets() {
  console.log('=== Test 1Password Integration ===\n');

  // 1. Vérifier que 1Password CLI est installé et authentifié
  console.log('1. Checking 1Password CLI...');
  const cliStatus = await check1PasswordCLI();

  if (!cliStatus.installed) {
    console.error('❌ 1Password CLI not installed!');
    console.error(`   ${cliStatus.error}`);
    process.exit(1);
  }

  if (!cliStatus.authenticated) {
    console.error('❌ 1Password CLI not authenticated!');
    console.error(`   ${cliStatus.error}`);
    process.exit(1);
  }

  console.log('✅ 1Password CLI installed and authenticated\n');

  // 2. Tester la lecture des secrets DAF
  console.log('2. Testing DAF secrets...\n');

  const secretsToTest = [
    'VA_API_KEY',
    'AZURE_DI_ENDPOINT',
    'AZURE_DI_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ] as const;

  for (const secretKey of secretsToTest) {
    try {
      console.log(`   Testing ${secretKey}...`);
      const value = await getSecret(secretKey, { skipCache: true, preferEnv: false });

      // Afficher les 10 premiers caractères seulement
      const preview = value.substring(0, 20) + '...';
      console.log(`   ✅ ${secretKey}: ${preview}`);
    } catch (error) {
      console.error(`   ❌ ${secretKey}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log('\n=== Test Complete ===');
}

// Run tests
testSecrets().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
