#!/usr/bin/env node

/**
 * Corematch MCP Server - Point d'entrée
 *
 * Usage:
 *   npm run mcp:server
 *   ou
 *   node bin/mcp-server.ts
 *   ou
 *   tsx bin/mcp-server.ts
 */

import { startMCPServer } from '../lib/mcp/server/mcp-server';

// Vérifier env vars requises
const requiredEnvVars = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach((varName) => {
    console.error(`   - ${varName}`);
  });
  console.error('\nPlease set these variables before starting the server.');
  console.error('Example (Linux/Mac):');
  console.error('  export NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co');
  console.error('  export SUPABASE_SERVICE_ROLE_KEY=xxx');
  console.error('\nExample (Windows):');
  console.error('  set NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co');
  console.error('  set SUPABASE_SERVICE_ROLE_KEY=xxx');
  process.exit(1);
}

// Démarrer serveur
startMCPServer().catch((error) => {
  console.error('❌ MCP Server failed to start:', error);
  process.exit(1);
});
