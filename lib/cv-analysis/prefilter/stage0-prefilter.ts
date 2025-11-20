/**
 * Stage 0 : Pré-filtre ultra-permissif
 *
 * Objectif : Éliminer seulement les CVs manifestement hors-scope
 * Principe : Mieux laisser passer un faux positif que rejeter un vrai candidat
 *
 * Utilise des softFlags pour guider needsMore() sans rejeter
 */

import type { CV_JSON, JobSpec, PrefilterResult } from '../types';
import { normalizeText, extractKeywords, jaccardSimilarity } from '../utils/normalize';
import { calculateTotalMonths } from '../utils/dates';

/**
 * Configuration du pré-filtre
 */
const PREFILTER_CONFIG = {
  // Seuils très permissifs (rejet seulement si manifestement hors-scope)
  min_experience_months: 0, // Pas de minimum (même les juniors)
  min_keyword_match: 0.05, // 5% de mots-clés en commun suffit
  min_sector_relevance: 0.02, // 2% de pertinence secteur

  // Seuils pour softFlags (indiquent doute, mais ne rejettent pas)
  weak_experience_threshold: 6, // < 6 mois = flag
  weak_keyword_threshold: 0.15, // < 15% mots-clés = flag
  weak_sector_threshold: 0.1, // < 10% secteur = flag
  weak_skills_threshold: 0.2, // < 20% compétences = flag
} as const;

/**
 * Pré-filtrer un CV (ultra-permissif)
 */
export async function prefilterCV(
  cv: CV_JSON,
  jobSpec: JobSpec
): Promise<PrefilterResult> {
  const startTime = Date.now();

  // Initialiser le résultat
  const softFlags: Record<string, number> = {};
  const reasons: string[] = [];
  let pass = true; // Par défaut : on laisse passer

  // =========================================================================
  // 1. Vérifier expérience minimale
  // =========================================================================
  const experienceMonths = calculateTotalMonths(
    cv.experiences.map((exp) => ({
      start: exp.date_debut || '',
      end: exp.date_fin || null,
    }))
  );

  if (experienceMonths === 0) {
    softFlags.no_experience = 0.8;
    reasons.push('Aucune expérience professionnelle listée');
  } else if (experienceMonths < PREFILTER_CONFIG.weak_experience_threshold) {
    softFlags.short_experience = experienceMonths / PREFILTER_CONFIG.weak_experience_threshold;
    reasons.push(`Expérience courte (${experienceMonths} mois)`);
  }

  // =========================================================================
  // 2. Matching secteur via mots-clés
  // =========================================================================

  // Extraire mots-clés du CV (missions + formations)
  const cvText = [
    ...cv.experiences.flatMap((exp) => exp.missions || []),
    ...cv.formations.map((f) => f.intitule),
    cv.competences.join(' '),
  ].join(' ');

  const cvKeywords = extractKeywords(cvText, 3);

  // Mots-clés du poste (relevance rules + skills) - avec fallback si non définis
  const jobKeywords = [
    ...(jobSpec.relevance_rules?.direct || []),
    ...(jobSpec.relevance_rules?.adjacent || []),
    ...(jobSpec.skills_required || []),
  ].flatMap((term) => extractKeywords(term, 3));

  // Similarité Jaccard
  const keywordSimilarity = jaccardSimilarity(cvKeywords, jobKeywords);

  if (keywordSimilarity < PREFILTER_CONFIG.min_keyword_match) {
    // Rejet UNIQUEMENT si vraiment aucun lien (< 5%)
    pass = false;
    reasons.push(`Aucun mot-clé pertinent trouvé (similarité: ${(keywordSimilarity * 100).toFixed(1)}%)`);
  } else if (keywordSimilarity < PREFILTER_CONFIG.weak_keyword_threshold) {
    softFlags.weak_sector_match = 1 - (keywordSimilarity / PREFILTER_CONFIG.weak_keyword_threshold);
    reasons.push(`Peu de mots-clés en commun (${(keywordSimilarity * 100).toFixed(1)}%)`);
  }

  // =========================================================================
  // 3. Matching compétences
  // =========================================================================

  const cvSkillsNormalized = cv.competences.map((s) => normalizeText(s));
  const requiredSkillsNormalized = (jobSpec.skills_required || []).map((s) => normalizeText(s));

  let matchedSkillsCount = 0;
  for (const reqSkill of requiredSkillsNormalized) {
    if (cvSkillsNormalized.some((cvSkill) =>
      cvSkill.includes(reqSkill) || reqSkill.includes(cvSkill)
    )) {
      matchedSkillsCount++;
    }
  }

  const skillsMatchRatio = requiredSkillsNormalized.length > 0
    ? matchedSkillsCount / requiredSkillsNormalized.length
    : 1.0; // Si aucune compétence requise, considérer comme match parfait

  if (skillsMatchRatio < PREFILTER_CONFIG.weak_skills_threshold) {
    softFlags.missing_key_skills = 1 - (skillsMatchRatio / PREFILTER_CONFIG.weak_skills_threshold);
    reasons.push(`Peu de compétences requises (${matchedSkillsCount}/${requiredSkillsNormalized.length})`);
  }

  // =========================================================================
  // 4. Must-have critiques (rejet si absent)
  // =========================================================================

  const criticalMustHave = jobSpec.must_have.filter((rule) => rule.severity === 'critical');

  for (const rule of criticalMustHave) {
    // Vérification basique : chercher mots-clés de la règle dans le CV
    const ruleKeywords = extractKeywords(rule.desc, 2);
    const cvHasKeywords = ruleKeywords.some((keyword) =>
      cvKeywords.includes(keyword)
    );

    if (!cvHasKeywords) {
      // Pour les must-have critiques, on met un flag fort mais on ne rejette pas encore
      // L'analyse complète décidera
      softFlags[`missing_critical_${rule.id}`] = 0.9;
      reasons.push(`Must-have critique possiblement absent: ${rule.desc}`);
    }
  }

  // =========================================================================
  // 5. Calculer la confiance globale
  // =========================================================================

  // Confiance = 1 - max(softFlags)
  const maxFlag = Object.values(softFlags).reduce((max, val) => Math.max(max, val), 0);
  const confidence = 1 - maxFlag;

  // =========================================================================
  // Résultat
  // =========================================================================

  const executionTime = Date.now() - startTime;

  return {
    pass,
    confidence,
    soft_flags: softFlags,
    reasons,
    execution_time_ms: executionTime,
  };
}

/**
 * Helper : Vérifier si un CV passe le pré-filtre
 */
export function shouldPrefilter(mode: 'eco' | 'balanced' | 'premium'): boolean {
  // Le pré-filtre est actif en mode balanced et premium
  // En mode eco, on skip pour économiser
  return mode === 'balanced' || mode === 'premium';
}

/**
 * Helper : Interpréter les softFlags pour needsMore()
 */
export function interpretSoftFlags(result: PrefilterResult): {
  needsCarefulReview: boolean;
  riskLevel: 'low' | 'medium' | 'high';
} {
  if (!result.pass) {
    return { needsCarefulReview: false, riskLevel: 'high' };
  }

  // Compter les flags significatifs (> 0.5)
  const significantFlags = Object.values(result.soft_flags).filter((val) => val > 0.5).length;

  if (significantFlags >= 3 || result.confidence < 0.4) {
    return { needsCarefulReview: true, riskLevel: 'high' };
  }

  if (significantFlags >= 2 || result.confidence < 0.6) {
    return { needsCarefulReview: true, riskLevel: 'medium' };
  }

  return { needsCarefulReview: false, riskLevel: 'low' };
}
