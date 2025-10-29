#!/usr/bin/env node

/**
 * Script de test pour serveur MCP
 * Configure des env vars de test et démarre le serveur
 */

// Configurer env vars de test
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test_service_role_key';
process.env.MCP_AUTH_HEADER = process.env.MCP_AUTH_HEADER || 'ApiKey mcp_sk_test123456789';

console.log('⚙️  Test Configuration:');
console.log('   NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10) + '...');
console.log('   MCP_AUTH_HEADER:', process.env.MCP_AUTH_HEADER?.substring(0, 20) + '...');
console.log('');

// Démarrer serveur
import('../lib/mcp/server/mcp-server').then(({ startMCPServer }) => {
  return startMCPServer();
}).catch((error) => {
  console.error('❌ MCP Server failed to start:', error);
  process.exit(1);
});
