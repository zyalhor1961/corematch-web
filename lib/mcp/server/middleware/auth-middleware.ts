/**
 * MCP Server Auth Middleware
 *
 * Vérifie l'authentification pour chaque requête MCP.
 * Supporte Bearer token (Supabase) et ApiKey (MCP API Keys).
 */

import { verifyMCPAuth, type MCPAuthUser } from '../../../auth/mcp-auth';

/**
 * Contexte MCP avec auth
 */
export interface MCPContext {
  authUser?: MCPAuthUser;
  sessionId?: string;
  requestId?: string;
}

/**
 * Middleware d'authentification MCP
 *
 * @param authHeader - Header Authorization (ex: "Bearer token" ou "ApiKey key")
 * @returns Contexte MCP avec authUser
 * @throws Error si auth échoue
 *
 * @example
 * const context = await authMiddleware(request.meta?.authorization);
 * console.log('Authenticated as:', context.authUser.email);
 */
export async function authMiddleware(authHeader?: string): Promise<MCPContext> {
  // Générer IDs de session/request
  const sessionId = crypto.randomUUID();
  const requestId = crypto.randomUUID();

  // Mode TEST: Bypass auth si clé de test (DEVELOPMENT ONLY)
  if (authHeader?.includes('mcp_sk_test')) {
    // SECURITY: Only allow test keys in development
    if (process.env.NODE_ENV === 'production') {
      console.error(`[MCP Auth] ❌ SECURITY: Test API keys not allowed in production`);
      throw new Error('AUTH_FAILED: Test API keys are not valid in production mode');
    }

    console.error(`[MCP Auth] ⚠️  TEST MODE: Using test API key (auth bypassed - development only)`);

    return {
      authUser: {
        id: 'test-user-123',
        type: 'mcp_api_key',
        scopes: ['cv:*', 'project:*'], // All scopes for testing
      },
      sessionId,
      requestId,
    };
  }

  // Vérifier auth
  if (!authHeader) {
    throw new Error('AUTH_REQUIRED: Missing Authorization header');
  }

  const authResult = await verifyMCPAuth(authHeader);

  if (!authResult.success) {
    throw new Error(`AUTH_FAILED: ${authResult.error}`);
  }

  console.error(`[MCP Auth] ✅ Authenticated as ${authResult.user!.type}:${authResult.user!.id}`);

  return {
    authUser: authResult.user,
    sessionId,
    requestId,
  };
}

/**
 * Extraire Authorization header depuis meta MCP
 */
export function extractAuthHeader(meta?: any): string | undefined {
  // MCP SDK peut passer l'auth de plusieurs façons
  return meta?.authorization || meta?.Authorization || meta?.auth;
}
