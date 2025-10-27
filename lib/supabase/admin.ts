/**
 * Supabase Admin Client (Service Role)
 *
 * ⚠️ ATTENTION: Ce client utilise la SERVICE ROLE KEY qui bypass RLS.
 * À utiliser UNIQUEMENT côté serveur pour:
 * - Opérations admin
 * - Vérifications consent
 * - Opérations système
 *
 * ❌ JAMAIS exposer ce client au client-side
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization pour permettre les tests sans env vars
let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (_supabaseAdmin) {
    return _supabaseAdmin;
  }

  // Validation des variables d'environnement
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!supabaseServiceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  _supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _supabaseAdmin;
}

/**
 * Client Supabase Admin (bypass RLS)
 *
 * Usage:
 * import { supabaseAdmin } from '@/lib/supabase/admin';
 *
 * const { data } = await supabaseAdmin
 *   .from('candidates')
 *   .select('consent_mcp')
 *   .eq('id', candidateId)
 *   .single();
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    const admin = getSupabaseAdmin();
    const value = (admin as any)[prop];
    return typeof value === 'function' ? value.bind(admin) : value;
  },
});

/**
 * Helper: Créer un audit log
 */
export async function createAuditLog(params: {
  entity_type: string;
  entity_id: string;
  action: string;
  user_id?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      action: params.action,
      user_id: params.user_id,
      metadata: params.metadata,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[createAuditLog] Failed to create audit log:', error);
    // Ne pas throw - les audit logs ne doivent pas bloquer les opérations
  }
}
