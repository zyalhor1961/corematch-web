/**
 * Règles de pertinence des expériences
 *
 * Détermine si une expérience est DIRECTE, ADJACENTE, PÉRIPHÉRIQUE ou NON_PERTINENTE
 * par rapport au poste cible.
 */

import type {
  CV_Experience,
  JobSpec,
  RelevanceLevel,
  Evidence,
  ExperienceRelevance,
} from '../types';
import { normalizeText, extractKeywords, jaccardSimilarity } from '../utils/normalize';
import { calculateMonths } from '../utils/dates';

/**
 * Seuils de pertinence (Jaccard similarity)
 */
const RELEVANCE_THRESHOLDS = {
  direct: 0.3, // ≥30% similarité = DIRECTE
  adjacent: 0.15, // ≥15% = ADJACENTE
  peripheral: 0.05, // ≥5% = PÉRIPHÉRIQUE
  // < 5% = NON_PERTINENTE
} as const;

/**
 * Évaluer la pertinence d'une expérience
 */
export function evaluateExperienceRelevance(
  experience: CV_Experience,
  jobSpec: JobSpec,
  analysisDate?: string
): ExperienceRelevance {
  // Extraire le texte de l'expérience
  const expText = [
    experience.titre,
    experience.employeur || '',
    ...(experience.missions || []),
  ].join(' ');

  const expKeywords = extractKeywords(expText, 3);

  // =========================================================================
  // 1. Tester DIRECTE
  // =========================================================================

  const directKeywords = jobSpec.relevance_rules.direct.flatMap((term) =>
    extractKeywords(term, 3)
  );

  const directSimilarity = jaccardSimilarity(expKeywords, directKeywords);

  if (directSimilarity >= RELEVANCE_THRESHOLDS.direct) {
    const evidence = buildEvidence(experience, expText, jobSpec.relevance_rules.direct);

    return {
      index: experience.index,
      titre: experience.titre,
      employeur: experience.employeur,
      start: experience.date_debut,
      end: experience.date_fin === 'en cours' ? null : experience.date_fin,
      relevance: 'DIRECTE',
      reason: `Forte correspondance avec mots-clés directs (${(directSimilarity * 100).toFixed(0)}%)`,
      evidence,
    };
  }

  // =========================================================================
  // 2. Tester ADJACENTE
  // =========================================================================

  const adjacentKeywords = jobSpec.relevance_rules.adjacent.flatMap((term) =>
    extractKeywords(term, 3)
  );

  const adjacentSimilarity = jaccardSimilarity(expKeywords, adjacentKeywords);

  if (adjacentSimilarity >= RELEVANCE_THRESHOLDS.adjacent || directSimilarity >= RELEVANCE_THRESHOLDS.adjacent) {
    const evidence = buildEvidence(experience, expText, [
      ...jobSpec.relevance_rules.direct,
      ...jobSpec.relevance_rules.adjacent,
    ]);

    return {
      index: experience.index,
      titre: experience.titre,
      employeur: experience.employeur,
      start: experience.date_debut,
      end: experience.date_fin === 'en cours' ? null : experience.date_fin,
      relevance: 'ADJACENTE',
      reason: `Compétences transférables détectées (${(Math.max(directSimilarity, adjacentSimilarity) * 100).toFixed(0)}%)`,
      evidence,
    };
  }

  // =========================================================================
  // 3. Tester PÉRIPHÉRIQUE
  // =========================================================================

  const peripheralKeywords = jobSpec.relevance_rules.peripheral.flatMap((term) =>
    extractKeywords(term, 3)
  );

  const peripheralSimilarity = jaccardSimilarity(expKeywords, peripheralKeywords);

  if (
    peripheralSimilarity >= RELEVANCE_THRESHOLDS.peripheral ||
    directSimilarity >= RELEVANCE_THRESHOLDS.peripheral ||
    adjacentSimilarity >= RELEVANCE_THRESHOLDS.peripheral
  ) {
    const evidence = buildEvidence(experience, expText, jobSpec.relevance_rules.peripheral);

    return {
      index: experience.index,
      titre: experience.titre,
      employeur: experience.employeur,
      start: experience.date_debut,
      end: experience.date_fin === 'en cours' ? null : experience.date_fin,
      relevance: 'PERIPHERIQUE',
      reason: `Même secteur mais fonction différente (${(peripheralSimilarity * 100).toFixed(0)}%)`,
      evidence,
    };
  }

  // =========================================================================
  // 4. Sinon: NON_PERTINENTE
  // =========================================================================

  return {
    index: experience.index,
    titre: experience.titre,
    employeur: experience.employeur,
    start: experience.date_debut,
    end: experience.date_fin === 'en cours' ? null : experience.date_fin,
    relevance: 'NON_PERTINENTE',
    reason: 'Expérience hors du champ du poste cible',
    evidence: [],
  };
}

/**
 * Construire des preuves (evidence) pour une expérience
 */
function buildEvidence(
  experience: CV_Experience,
  expText: string,
  relevantTerms: string[]
): Evidence[] {
  const evidence: Evidence[] = [];

  // Chercher des missions qui contiennent les termes pertinents
  if (experience.missions) {
    for (let i = 0; i < experience.missions.length; i++) {
      const mission = experience.missions[i];
      const missionNormalized = normalizeText(mission);

      for (const term of relevantTerms) {
        const termNormalized = normalizeText(term);
        if (missionNormalized.includes(termNormalized)) {
          evidence.push({
            quote: mission,
            field_path: `experiences[${experience.index}].missions[${i}]`,
          });
          break; // Une preuve par mission suffit
        }
      }
    }
  }

  // Si pas de preuve trouvée, utiliser le titre
  if (evidence.length === 0) {
    const titreNormalized = normalizeText(experience.titre);
    for (const term of relevantTerms) {
      const termNormalized = normalizeText(term);
      if (titreNormalized.includes(termNormalized)) {
        evidence.push({
          quote: experience.titre,
          field_path: `experiences[${experience.index}].titre`,
        });
        break;
      }
    }
  }

  // Si toujours pas de preuve, donner le titre comme preuve générale
  if (evidence.length === 0) {
    evidence.push({
      quote: experience.titre,
      field_path: `experiences[${experience.index}].titre`,
    });
  }

  return evidence;
}

/**
 * Évaluer toutes les expériences et calculer les mois par catégorie
 */
export function evaluateAllExperiences(
  cv: { experiences: CV_Experience[] },
  jobSpec: JobSpec,
  analysisDate?: string
): {
  by_experience: ExperienceRelevance[];
  months_direct: number;
  months_adjacent: number;
  months_peripheral: number;
  months_non_pertinent: number;
} {
  const byExperience = cv.experiences.map((exp) =>
    evaluateExperienceRelevance(exp, jobSpec, analysisDate)
  );

  let monthsDirect = 0;
  let monthsAdjacent = 0;
  let monthsPeripheral = 0;
  let monthsNonPertinent = 0;

  for (const expRel of byExperience) {
    const months = calculateMonths(expRel.start || '', expRel.end, analysisDate);

    switch (expRel.relevance) {
      case 'DIRECTE':
        monthsDirect += months;
        break;
      case 'ADJACENTE':
        monthsAdjacent += months;
        break;
      case 'PERIPHERIQUE':
        monthsPeripheral += months;
        break;
      case 'NON_PERTINENTE':
        monthsNonPertinent += months;
        break;
    }
  }

  return {
    by_experience: byExperience,
    months_direct: monthsDirect,
    months_adjacent: monthsAdjacent,
    months_peripheral: monthsPeripheral,
    months_non_pertinent: monthsNonPertinent,
  };
}
