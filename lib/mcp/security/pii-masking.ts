/**
 * PII (Personally Identifiable Information) Masking
 *
 * OBJECTIF: Protéger les données personnelles des candidats lors
 * de l'analyse via MCP ou providers externes
 *
 * RGPD Compliance:
 * - none: Aucun masking (usage interne uniquement)
 * - partial: Masque email/linkedin/téléphone (garde nom/prénom)
 * - full: Masque tout (nom, prénom, email, linkedin, téléphone, employeurs)
 *
 * Usage:
 * - MCP: Toujours appliquer au moins 'partial' avant envoi à LLM externe
 * - Interne: 'none' pour analyses internes (OpenAI, Gemini, Claude directs)
 * - Production: Configurable par projet (pii_masking_level)
 */

import type { CV_JSON } from '@/lib/cv-analysis/types';
import type { PIIMaskingLevel } from '@/lib/mcp/types/context-snapshot';

/**
 * Statistiques de masking (pour audit)
 */
export interface MaskingStats {
  level: PIIMaskingLevel;
  fields_masked: string[];
  masked_count: number;
}

/**
 * Masquer les données PII d'un CV selon le niveau spécifié
 *
 * @param cvJson - CV à masquer
 * @param level - Niveau de masking
 * @returns CV masqué + statistiques
 *
 * @example
 * // Masking partial (garde nom/prénom)
 * const { masked, stats } = maskPII(cvJson, 'partial');
 * console.log(masked.identite.email); // => "[EMAIL_MASKED]"
 * console.log(masked.identite.prenom); // => "Marie" (gardé)
 *
 * @example
 * // Masking full (tout masqué)
 * const { masked, stats } = maskPII(cvJson, 'full');
 * console.log(masked.identite.prenom); // => "[PRENOM_MASKED]"
 * console.log(masked.identite.email); // => "[EMAIL_MASKED]"
 */
export function maskPII(
  cvJson: CV_JSON,
  level: PIIMaskingLevel
): { masked: CV_JSON; stats: MaskingStats } {
  const stats: MaskingStats = {
    level,
    fields_masked: [],
    masked_count: 0,
  };

  // Niveau 'none': Pas de masking
  if (level === 'none') {
    return { masked: cvJson, stats };
  }

  // Clone profond pour ne pas modifier l'original
  const masked: CV_JSON = JSON.parse(JSON.stringify(cvJson));

  // =========================================================================
  // Partial + Full: Masquer email, linkedin, téléphone
  // =========================================================================

  if (masked.identite.email) {
    masked.identite.email = '[EMAIL_MASKED]';
    stats.fields_masked.push('identite.email');
    stats.masked_count++;
  }

  if (masked.identite.linkedin) {
    masked.identite.linkedin = '[LINKEDIN_MASKED]';
    stats.fields_masked.push('identite.linkedin');
    stats.masked_count++;
  }

  if ((masked.identite as any).telephone) {
    (masked.identite as any).telephone = '[PHONE_MASKED]';
    stats.fields_masked.push('identite.telephone');
    stats.masked_count++;
  }

  // =========================================================================
  // Full uniquement: Masquer nom, prénom, employeurs
  // =========================================================================

  if (level === 'full') {
    // Masquer prénom et nom
    masked.identite.prenom = '[PRENOM_MASKED]';
    masked.identite.nom = '[NOM_MASKED]';
    stats.fields_masked.push('identite.prenom', 'identite.nom');
    stats.masked_count += 2;

    // Masquer employeurs dans expériences
    masked.experiences = masked.experiences.map((exp, idx) => {
      if (exp.employeur) {
        stats.fields_masked.push(`experiences[${idx}].employeur`);
        stats.masked_count++;
        return {
          ...exp,
          employeur: '[COMPANY_MASKED]',
        };
      }
      return exp;
    });

    // Masquer établissements dans formations
    masked.formations = masked.formations.map((formation, idx) => {
      if (formation.etablissement) {
        stats.fields_masked.push(`formations[${idx}].etablissement`);
        stats.masked_count++;
        return {
          ...formation,
          etablissement: '[SCHOOL_MASKED]',
        };
      }
      return formation;
    });
  }

  return { masked, stats };
}

/**
 * Vérifier si un CV a été masqué
 * Détecte la présence de marqueurs [*_MASKED]
 */
export function isMasked(cvJson: CV_JSON): boolean {
  const jsonString = JSON.stringify(cvJson);
  return jsonString.includes('_MASKED]');
}

/**
 * Extraire le niveau de masking détecté dans un CV
 */
export function detectMaskingLevel(cvJson: CV_JSON): PIIMaskingLevel {
  const hasPrenomMasked = cvJson.identite.prenom.includes('MASKED');
  const hasEmailMasked = cvJson.identite.email?.includes('MASKED');

  if (hasPrenomMasked) {
    return 'full';
  } else if (hasEmailMasked) {
    return 'partial';
  } else {
    return 'none';
  }
}

/**
 * Vérifier le consent MCP d'un candidat
 *
 * @param candidateId - ID du candidat
 * @returns true si consent accordé, false sinon
 *
 * RGPD Compliance:
 * - Retourne false en cas d'erreur (fail-safe)
 * - Vérifie dans la DB Supabase
 */
export async function checkMCPConsent(candidateId: string): Promise<boolean> {
  try {
    // Import dynamique pour éviter les problèmes de circular deps
    const { supabaseAdmin } = await import('@/lib/supabase/admin');

    const { data, error } = await supabaseAdmin
      .from('candidates')
      .select('consent_mcp')
      .eq('id', candidateId)
      .single();

    if (error) {
      console.error('[checkMCPConsent] Database error:', error);
      return false; // Fail-safe: pas de consent en cas d'erreur
    }

    if (!data) {
      console.warn('[checkMCPConsent] Candidate not found:', candidateId);
      return false;
    }

    return data.consent_mcp === true;
  } catch (err) {
    console.error('[checkMCPConsent] Exception:', err);
    return false; // Fail-safe
  }
}

/**
 * Mettre à jour le consent MCP d'un candidat
 *
 * @param candidateId - ID du candidat
 * @param consent - Nouveau statut de consent
 * @throws Error si l'update échoue
 *
 * RGPD Compliance:
 * - Crée un audit log de chaque changement
 * - Timestamp de mise à jour
 */
export async function updateMCPConsent(
  candidateId: string,
  consent: boolean
): Promise<void> {
  try {
    const { supabaseAdmin, createAuditLog } = await import('@/lib/supabase/admin');

    // Update consent
    const { error } = await supabaseAdmin
      .from('candidates')
      .update({
        consent_mcp: consent,
        consent_mcp_updated_at: new Date().toISOString(),
      })
      .eq('id', candidateId);

    if (error) {
      console.error('[updateMCPConsent] Database error:', error);
      throw new Error(`Failed to update MCP consent: ${error.message}`);
    }

    // Audit log
    await createAuditLog({
      entity_type: 'candidate',
      entity_id: candidateId,
      action: consent ? 'mcp_consent_granted' : 'mcp_consent_revoked',
      metadata: {
        consent,
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`[updateMCPConsent] Consent ${consent ? 'granted' : 'revoked'} for candidate ${candidateId}`);
  } catch (err) {
    console.error('[updateMCPConsent] Exception:', err);
    throw err;
  }
}

/**
 * Obtenir le niveau de masking PII d'un projet
 *
 * @param projectId - ID du projet
 * @returns Niveau de masking configuré (défaut: 'partial')
 *
 * RGPD Compliance:
 * - Retourne 'partial' (sécurisé) en cas d'erreur
 * - Valide que le niveau est bien none/partial/full
 */
export async function getProjectPIIMaskingLevel(
  projectId: string
): Promise<PIIMaskingLevel> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase/admin');

    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('pii_masking_level')
      .eq('id', projectId)
      .single();

    if (error) {
      console.error('[getProjectPIIMaskingLevel] Database error:', error);
      return 'partial'; // Défaut sécurisé
    }

    if (!data) {
      console.warn('[getProjectPIIMaskingLevel] Project not found:', projectId);
      return 'partial';
    }

    const level = data.pii_masking_level as PIIMaskingLevel;

    // Validation du niveau
    if (!['none', 'partial', 'full'].includes(level)) {
      console.warn(
        `[getProjectPIIMaskingLevel] Invalid level "${level}" for project ${projectId}, using "partial"`
      );
      return 'partial';
    }

    return level;
  } catch (err) {
    console.error('[getProjectPIIMaskingLevel] Exception:', err);
    return 'partial'; // Fail-safe
  }
}

/**
 * Valider une requête d'analyse avec checks RGPD
 *
 * @throws Error si consent non accordé
 */
export async function validateAnalysisRequest(params: {
  candidateId: string;
  projectId: string;
  requireConsent: boolean;
}): Promise<{
  consent_granted: boolean;
  pii_masking_level: PIIMaskingLevel;
}> {
  // Check consent
  let consentGranted = false;

  if (params.requireConsent) {
    consentGranted = await checkMCPConsent(params.candidateId);

    if (!consentGranted) {
      throw new Error(
        `ERROR_CONSENT_REQUIRED: Candidate ${params.candidateId} has not granted MCP consent`
      );
    }
  }

  // Get masking level
  const maskingLevel = await getProjectPIIMaskingLevel(params.projectId);

  return {
    consent_granted: consentGranted,
    pii_masking_level: maskingLevel,
  };
}
