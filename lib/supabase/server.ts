import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getSupabaseSecrets } from '@/lib/secrets/1password'

export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}

/**
 * Admin client cache (singleton pattern)
 * Évite de re-créer le client à chaque appel
 */
let _supabaseAdminCache: SupabaseClient | null = null;

/**
 * Get Supabase admin client with service-role key from 1Password
 *
 * SÉCURITÉ:
 * - La clé service-role est récupérée depuis 1Password CLI (pas en clair)
 * - Fallback vers process.env en dev seulement
 * - Client mis en cache après première création
 *
 * @returns Supabase admin client
 */
export async function getSupabaseAdmin(): Promise<SupabaseClient> {
  // Retourner le client en cache si disponible
  if (_supabaseAdminCache) {
    return _supabaseAdminCache;
  }

  try {
    // Récupérer les secrets depuis 1Password
    const { url, serviceRoleKey } = await getSupabaseSecrets();

    // Créer le client admin
    _supabaseAdminCache = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    return _supabaseAdminCache;
  } catch (error) {
    console.error('[Supabase Admin] Failed to get secrets from 1Password:', error);

    // Fallback vers variables d'environnement (dev seulement)
    if (process.env.NODE_ENV !== 'production' && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[Supabase Admin] Using fallback env vars (dev mode)');

      _supabaseAdminCache = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      return _supabaseAdminCache;
    }

    throw new Error('Failed to initialize Supabase admin client');
  }
}

/**
 * @deprecated Use getSupabaseAdmin() instead for secure 1Password integration
 *
 * Legacy synchronous admin client (uses env vars directly)
 * Kept for backwards compatibility but should be migrated
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'MIGRATION_TO_1PASSWORD_IN_PROGRESS',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);