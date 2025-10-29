/**
 * Tests unitaires pour MCP Auth
 *
 * Tests:
 * 1. verifyMCPAuth() avec Bearer token (Supabase)
 * 2. verifyMCPAuth() avec ApiKey
 * 3. verifyMCPScope() pour vérifier permissions
 * 4. verifyMCPProjectAccess() pour vérifier accès projet
 */

import { describe, it as test, expect, beforeAll } from '@jest/globals';
import {
  verifyMCPAuth,
  verifyMCPApiKey,
  verifyMCPScope,
  verifyMCPProjectAccess,
  type MCPAuthUser,
} from '@/lib/auth/mcp-auth';

describe('MCP Auth', () => {
  // =========================================================================
  // Test 1: verifyMCPAuth() - Header invalide
  // =========================================================================

  test('verifyMCPAuth() rejette header vide', async () => {
    const result = await verifyMCPAuth('');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing Authorization header');
  });

  test('verifyMCPAuth() rejette format invalide', async () => {
    const result = await verifyMCPAuth('InvalidFormat token123');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid Authorization header format');
  });

  // =========================================================================
  // Test 2: verifyMCPAuth() - Bearer token (nécessite Supabase)
  // =========================================================================

  test('verifyMCPAuth() rejette Bearer token invalide', async () => {
    const result = await verifyMCPAuth('Bearer invalid_token_123');

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  // =========================================================================
  // Test 3: verifyMCPApiKey() - Format
  // =========================================================================

  test('verifyMCPApiKey() rejette format invalide', async () => {
    const result = await verifyMCPApiKey('invalid_key');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid API key format');
  });

  test('verifyMCPApiKey() accepte format mcp_sk_...', async () => {
    // Note: Cette clé n'existe pas en DB, donc sera rejetée
    // Mais le test vérifie que le format est accepté (pas de rejet immédiat)
    const result = await verifyMCPApiKey('mcp_sk_abc123def456ghi789jkl012mno345pqr678stu901');

    expect(result.success).toBe(false);
    // L'erreur devrait être "not found", pas "invalid format"
    expect(result.error).not.toContain('Invalid API key format');
  });

  // =========================================================================
  // Test 4: verifyMCPScope() - Vérification scopes
  // =========================================================================

  test('verifyMCPScope() autorise tous scopes pour Supabase users', () => {
    const supabaseUser: MCPAuthUser = {
      id: 'user-123',
      email: 'test@example.com',
      type: 'supabase_token',
    };

    expect(verifyMCPScope(supabaseUser, 'cv:analyze')).toBe(true);
    expect(verifyMCPScope(supabaseUser, 'cv:write')).toBe(true);
    expect(verifyMCPScope(supabaseUser, 'project:read')).toBe(true);
  });

  test('verifyMCPScope() vérifie scopes pour API keys', () => {
    const apiKeyUser: MCPAuthUser = {
      id: 'user-123',
      type: 'mcp_api_key',
      scopes: ['cv:analyze', 'cv:read'],
    };

    expect(verifyMCPScope(apiKeyUser, 'cv:analyze')).toBe(true);
    expect(verifyMCPScope(apiKeyUser, 'cv:read')).toBe(true);
    expect(verifyMCPScope(apiKeyUser, 'cv:write')).toBe(false);
    expect(verifyMCPScope(apiKeyUser, 'project:read')).toBe(false);
  });

  test('verifyMCPScope() supporte wildcards', () => {
    const apiKeyUser: MCPAuthUser = {
      id: 'user-123',
      type: 'mcp_api_key',
      scopes: ['cv:*'],
    };

    expect(verifyMCPScope(apiKeyUser, 'cv:analyze')).toBe(true);
    expect(verifyMCPScope(apiKeyUser, 'cv:read')).toBe(true);
    expect(verifyMCPScope(apiKeyUser, 'cv:write')).toBe(true);
    expect(verifyMCPScope(apiKeyUser, 'project:read')).toBe(false);
  });

  test('verifyMCPScope() refuse accès si pas de scopes', () => {
    const apiKeyUser: MCPAuthUser = {
      id: 'user-123',
      type: 'mcp_api_key',
      scopes: [],
    };

    expect(verifyMCPScope(apiKeyUser, 'cv:analyze')).toBe(false);
  });

  // =========================================================================
  // Test 5: verifyMCPProjectAccess() - Accès projet
  // =========================================================================

  test('verifyMCPProjectAccess() autorise si API key limitée au bon projet', async () => {
    const apiKeyUser: MCPAuthUser = {
      id: 'user-123',
      type: 'mcp_api_key',
      project_id: 'project-123',
      scopes: ['cv:analyze'],
    };

    const hasAccess = await verifyMCPProjectAccess(apiKeyUser, 'project-123');
    expect(hasAccess).toBe(true);
  });

  test('verifyMCPProjectAccess() refuse si API key limitée à autre projet', async () => {
    const apiKeyUser: MCPAuthUser = {
      id: 'user-123',
      type: 'mcp_api_key',
      project_id: 'project-123',
      scopes: ['cv:analyze'],
    };

    const hasAccess = await verifyMCPProjectAccess(apiKeyUser, 'project-456');
    expect(hasAccess).toBe(false);
  });

  // =========================================================================
  // Test 6: Intégration complète (format uniquement, pas de DB)
  // =========================================================================

  test('Format header ApiKey complet', async () => {
    const authHeader = 'ApiKey mcp_sk_abc123def456ghi789jkl012mno345pqr678stu901';
    const result = await verifyMCPAuth(authHeader);

    // La clé n'existe pas en DB, donc échec attendu
    expect(result.success).toBe(false);

    // Mais le format est correct, pas d'erreur de parsing
    expect(result.error).not.toContain('Invalid Authorization header format');
  });
});
