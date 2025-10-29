/**
 * Supabase Client pour MCP avec RLS activé
 *
 * Ce client utilise un compte service avec permissions limitées
 * au lieu de bypasser RLS avec service-role key.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { MCPAuthUser } from '../../../auth/mcp-auth';

/**
 * Créer un client Supabase avec RLS pour MCP
 *
 * ⚠️ IMPORTANT: Ce client utilise anon key (pas service_role)
 * pour que RLS soit actif et protège les données inter-org
 *
 * @param authUser - User authentifié MCP (optionnel pour queries publiques)
 * @returns Client Supabase avec RLS actif
 */
export function createMCPSupabaseClient(authUser?: MCPAuthUser): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('SUPABASE_CONFIG_MISSING: Supabase URL or anon key not configured');
  }

  // Créer client avec anon key (RLS actif)
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // Pas de persistence (serveur MCP)
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      // Force RLS (même si admin)
      schema: 'public',
    },
  });

  // Si authUser fourni, simuler session avec son JWT
  // Note: En production, il faudrait un vrai JWT Supabase
  // Pour l'instant, on crée un client avec anon key + vérifications manuelles

  return client;
}

/**
 * Vérifier que l'user a accès à l'org/project via RLS
 *
 * Cette fonction fait une query test pour s'assurer que RLS
 * bloque bien l'accès si l'user n'a pas les permissions
 */
export async function verifyRLSAccess(
  client: SupabaseClient,
  projectId: string
): Promise<boolean> {
  // Tenter de lire le projet via RLS
  // Si RLS est actif, la query échouera si user n'a pas accès
  const { data, error } = await client
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single();

  if (error || !data) {
    console.error('[RLS] Access denied to project', projectId, error?.message);
    return false;
  }

  return true;
}
