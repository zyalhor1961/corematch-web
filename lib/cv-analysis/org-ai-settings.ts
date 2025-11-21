/**
 * Organization AI Settings Loader
 *
 * Loads org-specific AI instructions from the database.
 * These instructions are injected into prompts at runtime.
 */

import { getSupabaseAdmin } from '@/lib/supabase/server';
import type { OrgAISettings } from '@/lib/types';

/**
 * Load organization AI settings from the database.
 * Returns null if no custom settings exist (use defaults).
 *
 * @param orgId - Organization ID
 * @returns OrgAISettings or null if not found
 */
export async function loadOrgAISettings(
  orgId: string | undefined | null
): Promise<OrgAISettings | null> {
  if (!orgId) {
    console.log('[loadOrgAISettings] No orgId provided, using default settings');
    return null;
  }

  try {
    const supabase = await getSupabaseAdmin();

    const { data, error } = await supabase
      .from('org_ai_settings')
      .select('*')
      .eq('org_id', orgId)
      .single();

    // PGRST116 = no rows returned (org has no custom settings)
    if (error) {
      if (error.code === 'PGRST116') {
        console.log(`[loadOrgAISettings] No custom settings for org ${orgId}, using defaults`);
        return null;
      }
      console.error('[loadOrgAISettings] Error loading settings:', error);
      return null;
    }

    if (data) {
      console.log(`[loadOrgAISettings] Loaded custom AI settings for org ${orgId}`);
    }

    return data as OrgAISettings;
  } catch (error) {
    console.error('[loadOrgAISettings] Unexpected error:', error);
    return null;
  }
}

/**
 * Check if an organization has custom AI settings configured.
 *
 * @param orgId - Organization ID
 * @returns true if custom settings exist
 */
export async function hasOrgAISettings(orgId: string): Promise<boolean> {
  const settings = await loadOrgAISettings(orgId);
  return settings !== null;
}
