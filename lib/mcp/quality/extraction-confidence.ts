/**
 * Extraction Confidence Scorer (MCP Point #6)
 *
 * OBJECTIF: Évaluer la confiance dans l'extraction du CV pour décider
 * du mode d'analyse optimal (eco/balanced/premium).
 *
 * Critères:
 * - Complétude des champs obligatoires
 * - Qualité des dates
 * - Richesse des descriptions
 * - Cohérence des données
 *
 * Score: 0-100
 * - 0-50: Faible confiance → Upgrade vers balanced/premium
 * - 50-80: Confiance moyenne → Mode recommandé
 * - 80-100: Haute confiance → Peut utiliser eco
 */

import type { CV_JSON } from '@/lib/cv-analysis/types';
import type { ExtractionConfidenceScore } from './types';

/**
 * Calcule le score de confiance de l'extraction
 */
export function scoreExtractionConfidence(
  cvJson: CV_JSON
): ExtractionConfidenceScore {
  const issues: string[] = [];
  const missing_fields: string[] = [];

  // 1. Confiance identité (0-100)
  const identity_confidence = scoreIdentityConfidence(
    cvJson.identite,
    missing_fields,
    issues
  );

  // 2. Confiance expériences (0-100)
  const experiences_confidence = scoreExperiencesConfidence(
    cvJson.experiences,
    missing_fields,
    issues
  );

  // 3. Confiance formations (0-100)
  const formations_confidence = scoreFormationsConfidence(
    cvJson.formations,
    missing_fields,
    issues
  );

  // 4. Confiance compétences (0-100)
  const competences_confidence = scoreCompetencesConfidence(
    cvJson.competences,
    missing_fields,
    issues
  );

  // 5. Moyenne pondérée (expériences = 40%, reste = 20% chacun)
  const overall_confidence =
    identity_confidence * 0.2 +
    experiences_confidence * 0.4 +
    formations_confidence * 0.2 +
    competences_confidence * 0.2;

  return {
    overall_confidence: Math.round(overall_confidence),
    identity_confidence: Math.round(identity_confidence),
    experiences_confidence: Math.round(experiences_confidence),
    formations_confidence: Math.round(formations_confidence),
    competences_confidence: Math.round(competences_confidence),
    missing_fields,
    issues,
  };
}

/**
 * Score la confiance de la section identité
 */
function scoreIdentityConfidence(
  identite: CV_JSON['identite'],
  missing: string[],
  issues: string[]
): number {
  let score = 100;

  // Champs obligatoires
  if (!identite.prenom || identite.prenom === 'INFORMATION_MANQUANTE') {
    score -= 30;
    missing.push('identite.prenom');
  }
  if (!identite.nom || identite.nom === 'INFORMATION_MANQUANTE') {
    score -= 30;
    missing.push('identite.nom');
  }

  // Champs optionnels mais recommandés
  if (!identite.email) {
    score -= 10;
    missing.push('identite.email');
  }

  return Math.max(0, score);
}

/**
 * Score la confiance des expériences
 */
function scoreExperiencesConfidence(
  experiences: CV_JSON['experiences'],
  missing: string[],
  issues: string[]
): number {
  if (experiences.length === 0) {
    issues.push('Aucune expérience trouvée');
    return 0;
  }

  let totalScore = 0;

  for (const exp of experiences) {
    let expScore = 100;

    // Titre obligatoire
    if (!exp.titre || exp.titre === 'INFORMATION_MANQUANTE') {
      expScore -= 40;
      missing.push(`experiences[${exp.index}].titre`);
    }

    // Date début recommandée
    if (!exp.date_debut || exp.date_debut === 'INFORMATION_MANQUANTE') {
      expScore -= 20;
      missing.push(`experiences[${exp.index}].date_debut`);
    } else if (!isValidDate(exp.date_debut)) {
      expScore -= 10;
      issues.push(`Date debut invalide: ${exp.date_debut}`);
    }

    // Date fin (optionnelle mais utile)
    if (
      exp.date_fin &&
      exp.date_fin !== 'en cours' &&
      exp.date_fin !== null &&
      !isValidDate(exp.date_fin)
    ) {
      expScore -= 10;
      issues.push(`Date fin invalide: ${exp.date_fin}`);
    }

    // Missions recommandées
    if (!exp.missions || exp.missions.length === 0) {
      expScore -= 20;
    } else if (
      exp.missions.some(
        (m) => m.length < 10 || m === 'INFORMATION_MANQUANTE'
      )
    ) {
      expScore -= 10;
      issues.push('Missions trop vagues');
    }

    totalScore += Math.max(0, expScore);
  }

  return totalScore / experiences.length;
}

/**
 * Score la confiance des formations
 */
function scoreFormationsConfidence(
  formations: CV_JSON['formations'],
  missing: string[],
  issues: string[]
): number {
  if (formations.length === 0) {
    // Acceptable de ne pas avoir de formation
    return 70;
  }

  let totalScore = 0;

  for (const form of formations) {
    let formScore = 100;

    // Intitulé obligatoire
    if (!form.intitule || form.intitule === 'INFORMATION_MANQUANTE') {
      formScore -= 40;
      missing.push(`formations[${form.index}].intitule`);
    }

    // Établissement recommandé
    if (!form.etablissement || form.etablissement === 'INFORMATION_MANQUANTE') {
      formScore -= 20;
      missing.push(`formations[${form.index}].etablissement`);
    }

    // Année recommandée
    if (!form.annee || form.annee === 'INFORMATION_MANQUANTE') {
      formScore -= 20;
      missing.push(`formations[${form.index}].annee`);
    } else if (!isValidYear(form.annee)) {
      formScore -= 10;
      issues.push(`Année invalide: ${form.annee}`);
    }

    totalScore += Math.max(0, formScore);
  }

  return totalScore / formations.length;
}

/**
 * Score la confiance des compétences
 */
function scoreCompetencesConfidence(
  competences: string[],
  missing: string[],
  issues: string[]
): number {
  if (competences.length === 0) {
    issues.push('Aucune compétence trouvée');
    return 0;
  }

  let score = 100;

  // Pénalité si trop peu de compétences
  if (competences.length < 3) {
    score -= 30;
    issues.push('Moins de 3 compétences');
  }

  // Pénalité si compétences vagues
  const vagueCount = competences.filter(
    (c) => c.length < 3 || c === 'INFORMATION_MANQUANTE'
  ).length;
  if (vagueCount > 0) {
    score -= vagueCount * 10;
    issues.push(`${vagueCount} compétences vagues`);
  }

  return Math.max(0, score);
}

/**
 * Valide un format de date YYYY-MM
 */
function isValidDate(dateStr: string): boolean {
  if (!dateStr || dateStr === 'INFORMATION_MANQUANTE') {
    return false;
  }

  // Format YYYY-MM
  const match = dateStr.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return false;
  }

  const year = parseInt(match[1]);
  const month = parseInt(match[2]);

  return year >= 1950 && year <= 2030 && month >= 1 && month <= 12;
}

/**
 * Valide une année YYYY
 */
function isValidYear(yearStr: string): boolean {
  if (!yearStr || yearStr === 'INFORMATION_MANQUANTE') {
    return false;
  }

  const year = parseInt(yearStr);
  return !isNaN(year) && year >= 1950 && year <= 2030;
}
