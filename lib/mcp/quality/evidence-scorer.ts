/**
 * Evidence Quality Scorer (MCP Point #5)
 *
 * Score la qualité des evidences/citations:
 * - 0 (weak): Vague, pas de citation précise
 * - 1 (medium): Précis mais pas de field_path
 * - 2 (strong): Citation exacte avec field_path
 *
 * Usage:
 * const result = scoreEvidenceQuality(evidences);
 * if (result.average_quality >= 1.0) { ... }
 */

import type { Evidence } from '@/lib/cv-analysis/types';
import type {
  EvidenceQualityScore,
  EvidenceQualityResult,
} from './types';

/**
 * Score une evidence individuelle (0-2)
 */
export function scoreEvidence(evidence: Evidence): EvidenceQualityScore {
  const { quote, field_path } = evidence;

  // Vérifier si le field_path est valide
  const hasValidFieldPath =
    field_path &&
    field_path.length > 0 &&
    field_path !== 'INFORMATION_MANQUANTE';

  // Vérifier si la quote est valide et précise
  const hasValidQuote = quote && quote.length > 10;
  const isVague = isVagueQuote(quote || '');

  // Score 2 (strong): Citation exacte + field_path valide
  if (hasValidFieldPath && hasValidQuote && !isVague) {
    return {
      evidence,
      quality_score: 2,
      reason: 'Citation exacte avec field_path précis',
    };
  }

  // Score 1 (medium): Citation précise mais sans field_path
  if (hasValidQuote && !isVague) {
    return {
      evidence,
      quality_score: 1,
      reason: 'Citation précise mais field_path manquant',
    };
  }

  // Score 0 (weak): Citation vague ou manquante
  return {
    evidence,
    quality_score: 0,
    reason: 'Citation vague ou insuffisante',
  };
}

/**
 * Détecte si une citation est vague
 */
function isVagueQuote(quote: string): boolean {
  const normalized = quote.toLowerCase().trim();

  // Citation trop courte
  if (normalized.length < 10) {
    return true;
  }

  // Patterns vagues (phrases génériques sans détails)
  const vaguePatterns = [
    /^a de l'expérience$/i,
    /^a travaillé avec/i, // "a travaillé avec X" est vague
    /^a utilisé/i, // "a utilisé X" est vague
    /^compétences en$/i,
    /^connaissances en$/i,
    /^maîtrise de/i, // "maîtrise de X" est vague
    /information manquante/i,
    /non précisé/i,
    /^n\/a$/i,
  ];

  // Vérifier si la citation contient un pattern vague
  if (vaguePatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  // Vérifier si la citation est trop générique (moins de 5 mots significatifs)
  const wordCount = normalized.split(/\s+/).filter(w => w.length > 2).length;
  if (wordCount < 5) {
    return true;
  }

  return false;
}

/**
 * Score un ensemble d'evidences et retourne les métriques
 */
export function scoreEvidenceQuality(
  evidences: Evidence[]
): EvidenceQualityResult {
  if (evidences.length === 0) {
    return {
      total_evidences: 0,
      weak_count: 0,
      medium_count: 0,
      strong_count: 0,
      average_quality: 0,
      quality_percentage: 0,
      scores: [],
      passes_threshold: false,
    };
  }

  const scores = evidences.map(scoreEvidence);

  const weak_count = scores.filter((s) => s.quality_score === 0).length;
  const medium_count = scores.filter((s) => s.quality_score === 1).length;
  const strong_count = scores.filter((s) => s.quality_score === 2).length;

  const total_quality_points = scores.reduce(
    (sum, s) => sum + s.quality_score,
    0
  );
  const max_possible_points = evidences.length * 2;
  const average_quality = total_quality_points / evidences.length;
  const quality_percentage = (total_quality_points / max_possible_points) * 100;

  return {
    total_evidences: evidences.length,
    weak_count,
    medium_count,
    strong_count,
    average_quality,
    quality_percentage,
    scores,
    passes_threshold: false, // Sera déterminé par le gating
  };
}

/**
 * Extrait toutes les evidences d'un résultat d'évaluation
 */
export function extractAllEvidences(evaluationResult: any): Evidence[] {
  const allEvidences: Evidence[] = [];

  // Evidences des expériences pertinentes
  if (evaluationResult.relevance_summary?.by_experience) {
    for (const exp of evaluationResult.relevance_summary.by_experience) {
      if (exp.evidence && Array.isArray(exp.evidence)) {
        allEvidences.push(...exp.evidence);
      }
    }
  }

  // Evidences des fails
  if (evaluationResult.fails && Array.isArray(evaluationResult.fails)) {
    for (const fail of evaluationResult.fails) {
      if (fail.evidence && Array.isArray(fail.evidence)) {
        allEvidences.push(...fail.evidence);
      }
    }
  }

  // Evidences des strengths
  if (evaluationResult.strengths && Array.isArray(evaluationResult.strengths)) {
    for (const strength of evaluationResult.strengths) {
      if (strength.evidence && Array.isArray(strength.evidence)) {
        allEvidences.push(...strength.evidence);
      }
    }
  }

  // Evidences globales
  if (
    evaluationResult.evidence_global &&
    Array.isArray(evaluationResult.evidence_global)
  ) {
    allEvidences.push(...evaluationResult.evidence_global);
  }

  return allEvidences;
}
