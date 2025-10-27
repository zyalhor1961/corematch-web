/**
 * MCP Authentication
 *
 * OBJECTIF: Auth flexible pour serveur MCP (sans dépendance NextRequest)
 *
 * Méthodes supportées:
 * 1. Supabase Bearer token (utilisateurs web)
 * 2. MCP API Key (serveurs, CLI, intégrations)
 *
 * Usage:
 * - Serveur MCP: Utilise verifyMCPAuth(authHeader)
 * - Next.js API: Continue d'utiliser verify-auth.ts
 */

import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Type d'auth détecté
 */
export type AuthType = 'supabase_token' | 'mcp_api_key' | 'none';

/**
 * Utilisateur authentifié (via Supabase ou API key)
 */
export interface MCPAuthUser {
  id: string;
  email?: string;
  type: AuthType;
  org_id?: string; // Pour API keys, peut être limité à une org
  project_id?: string; // Pour API keys, peut être limité à un projet
  scopes?: string[]; // Permissions de l'API key (ex: ['cv:analyze', 'cv:read'])
}

/**
 * Résultat d'authentification
 */
export interface MCPAuthResult {
  success: boolean;
  user?: MCPAuthUser;
  error?: string;
}

/**
 * Vérifier l'authentification MCP depuis un header Authorization
 *
 * @param authHeader - Header Authorization (ex: "Bearer token" ou "ApiKey key")
 * @returns Résultat d'authentification
 *
 * @example
 * // Supabase token
 * const result = await verifyMCPAuth('Bearer eyJhbGci...');
 * if (result.success) {
 *   console.log('User:', result.user.email);
 * }
 *
 * @example
 * // MCP API Key
 * const result = await verifyMCPAuth('ApiKey mcp_sk_abc123...');
 * if (result.success) {
 *   console.log('Org:', result.user.org_id);
 * }
 */
export async function verifyMCPAuth(authHeader: string): Promise<MCPAuthResult> {
  if (!authHeader) {
    return {
      success: false,
      error: 'Missing Authorization header',
    };
  }

  // =========================================================================
  // Méthode 1: Bearer token (Supabase)
  // =========================================================================

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        return {
          success: false,
          error: 'Supabase environment variables not configured',
        };
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      });

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error || !user) {
        return {
          success: false,
          error: 'Invalid Supabase token',
        };
      }

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          type: 'supabase_token',
        },
      };
    } catch (err) {
      console.error('[verifyMCPAuth] Supabase token verification error:', err);
      return {
        success: false,
        error: 'Token verification failed',
      };
    }
  }

  // =========================================================================
  // Méthode 2: ApiKey (MCP API Key)
  // =========================================================================

  if (authHeader.startsWith('ApiKey ')) {
    const apiKey = authHeader.substring(7);

    return verifyMCPApiKey(apiKey);
  }

  // =========================================================================
  // Format non reconnu
  // =========================================================================

  return {
    success: false,
    error: 'Invalid Authorization header format (expected "Bearer <token>" or "ApiKey <key>")',
  };
}

/**
 * Vérifier une MCP API Key depuis la DB
 *
 * @param apiKey - Clé API (ex: "mcp_sk_abc123...")
 * @returns Résultat d'authentification
 *
 * Format attendu: mcp_sk_{random32chars}
 *
 * @example
 * const result = await verifyMCPApiKey('mcp_sk_abc123...');
 * if (result.success) {
 *   console.log('Scopes:', result.user.scopes);
 * }
 */
export async function verifyMCPApiKey(apiKey: string): Promise<MCPAuthResult> {
  try {
    // Validation format
    if (!apiKey.startsWith('mcp_sk_')) {
      return {
        success: false,
        error: 'Invalid API key format (expected mcp_sk_...)',
      };
    }

    // Query DB pour trouver l'API key
    const { data, error } = await supabaseAdmin
      .from('mcp_api_keys')
      .select('id, user_id, org_id, project_id, scopes, is_active, expires_at')
      .eq('key_hash', hashApiKey(apiKey))
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.error('[verifyMCPApiKey] API key not found or DB error:', error);
      return {
        success: false,
        error: 'Invalid or inactive API key',
      };
    }

    // Vérifier expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      console.warn('[verifyMCPApiKey] API key expired:', data.id);
      return {
        success: false,
        error: 'API key expired',
      };
    }

    // Update last_used_at
    await supabaseAdmin
      .from('mcp_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id);

    return {
      success: true,
      user: {
        id: data.user_id,
        type: 'mcp_api_key',
        org_id: data.org_id,
        project_id: data.project_id,
        scopes: data.scopes || [],
      },
    };
  } catch (err) {
    console.error('[verifyMCPApiKey] Exception:', err);
    return {
      success: false,
      error: 'API key verification failed',
    };
  }
}

/**
 * Hasher une API key pour stockage sécurisé
 * Utilise SHA-256 via Node.js crypto
 */
function hashApiKey(apiKey: string): string {
  // Utiliser crypto.createHash pour Node.js
  // Note: En production, même hash utilisé en SQL (voir migration)
  try {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
    return `sha256_${hash}`;
  } catch (err) {
    // Fallback si crypto non disponible (ne devrait jamais arriver)
    console.error('[hashApiKey] Crypto not available:', err);
    return `sha256_${apiKey.substring(0, 8)}_${apiKey.length}`;
  }
}

/**
 * Vérifier si un utilisateur a accès à un projet
 *
 * @param authUser - Utilisateur authentifié
 * @param projectId - ID du projet
 * @returns true si accès autorisé
 *
 * @example
 * const authResult = await verifyMCPAuth(authHeader);
 * if (authResult.success) {
 *   const hasAccess = await verifyMCPProjectAccess(authResult.user, 'project-123');
 * }
 */
export async function verifyMCPProjectAccess(
  authUser: MCPAuthUser,
  projectId: string
): Promise<boolean> {
  try {
    // Si API key limitée à un projet, vérifier que c'est le bon
    if (authUser.type === 'mcp_api_key' && authUser.project_id) {
      return authUser.project_id === projectId;
    }

    // Si API key limitée à une org, vérifier que le projet appartient à cette org
    if (authUser.type === 'mcp_api_key' && authUser.org_id) {
      const { data: project, error } = await supabaseAdmin
        .from('projects')
        .select('org_id')
        .eq('id', projectId)
        .single();

      if (error || !project) {
        console.error('[verifyMCPProjectAccess] Project not found:', projectId);
        return false;
      }

      return project.org_id === authUser.org_id;
    }

    // Si utilisateur Supabase, utiliser la même logique que verify-auth.ts
    if (authUser.type === 'supabase_token') {
      const { verifyProjectAccess } = await import('./verify-auth');
      return verifyProjectAccess(authUser.id, projectId);
    }

    // Si API key sans restriction (org_id et project_id NULL), vérifier l'accès via l'organisation
    if (authUser.type === 'mcp_api_key') {
      console.error(`[verifyMCPProjectAccess] Checking access for user ${authUser.id} to project ${projectId}`);

      const { data: project, error } = await supabaseAdmin
        .from('projects')
        .select('created_by, org_id')
        .eq('id', projectId)
        .single();

      if (error || !project) {
        console.error('[verifyMCPProjectAccess] Project not found:', projectId, error);
        return false;
      }

      console.error(`[verifyMCPProjectAccess] Project data: created_by=${project.created_by}, org_id=${project.org_id}`);

      // Cas 1: Le projet a un created_by qui correspond à l'utilisateur
      if (project.created_by && project.created_by === authUser.id) {
        console.error(`[verifyMCPProjectAccess] Case 1 (created_by): MATCH - access granted`);
        return true;
      }

      // Cas 2: Le projet appartient à une organisation (vérifié même si created_by existe mais ne correspond pas)
      if (project.org_id) {
        console.error(`[verifyMCPProjectAccess] Checking membership in org ${project.org_id}`);

        // Vérifier que l'utilisateur est membre de cette organisation
        const { data: membership, error: membershipError } = await supabaseAdmin
          .from('organization_members')
          .select('user_id, role')
          .eq('org_id', project.org_id)
          .eq('user_id', authUser.id)
          .maybeSingle();

        if (membershipError) {
          console.error('[verifyMCPProjectAccess] Membership check error:', membershipError);
          return false;
        }

        const hasAccess = !!membership;
        console.error(`[verifyMCPProjectAccess] Case 2 (org): membership=${hasAccess}`);
        return hasAccess;
      }

      // Cas 3: Le projet a un created_by qui ne correspond pas et pas d'org_id
      if (project.created_by) {
        console.error(`[verifyMCPProjectAccess] Case 3 (created_by): NO MATCH - access denied`);
        return false;
      }

      // Cas 3: Projet sans created_by ni org_id -> refuser
      console.error('[verifyMCPProjectAccess] Case 3: No created_by or org_id - access denied');
      return false;
    }

    // Cas par défaut: pas d'accès
    return false;
  } catch (err) {
    console.error('[verifyMCPProjectAccess] Exception:', err);
    return false;
  }
}

/**
 * Vérifier si un utilisateur a un scope spécifique
 *
 * @param authUser - Utilisateur authentifié
 * @param scope - Scope requis (ex: 'cv:analyze', 'cv:read')
 * @returns true si scope accordé
 *
 * Scopes disponibles:
 * - cv:analyze - Analyser un CV
 * - cv:read - Lire les résultats d'analyse
 * - cv:write - Modifier les résultats
 * - project:read - Lire les projets
 * - project:write - Modifier les projets
 *
 * @example
 * if (!verifyMCPScope(authUser, 'cv:analyze')) {
 *   return { error: 'Insufficient permissions' };
 * }
 */
export function verifyMCPScope(authUser: MCPAuthUser, scope: string): boolean {
  // Utilisateurs Supabase ont tous les scopes
  if (authUser.type === 'supabase_token') {
    return true;
  }

  // API keys: vérifier scopes
  if (authUser.type === 'mcp_api_key') {
    // Si pas de scopes définis, accès refusé (sécurisé)
    if (!authUser.scopes || authUser.scopes.length === 0) {
      return false;
    }

    // Vérifier si scope exact ou wildcard (ex: 'cv:*')
    return authUser.scopes.some((s) => {
      if (s === scope) return true;
      if (s.endsWith(':*') && scope.startsWith(s.substring(0, s.length - 1))) return true;
      return false;
    });
  }

  return false;
}
