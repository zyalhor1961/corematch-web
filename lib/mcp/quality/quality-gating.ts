/**
 * Quality Gating - Validation de qualité des evidences (MCP Point #5)
 *
 * OBJECTIF: Garantir que les LLMs fournissent des citations de qualité
 * suffisante avant de valider une analyse.
 *
 * Flow:
 * 1. Extraire toutes les evidences du résultat d'évaluation
 * 2. Scorer chaque evidence (0-2)
 * 3. Calculer métriques globales
 * 4. Décider: proceed | reject | fallback_reextract
 *
 * Usage:
 * const decision = applyQualityGating(evaluationResult, config);
 * if (decision.action === 'fallback_reextract') {
 *   // Re-extraire avec prompt amélioré
 * }
 */

import type { Evidence } from '@/lib/cv-analysis/types';
import {
  scoreEvidenceQuality,
  extractAllEvidences,
} from './evidence-scorer';
import type {
  QualityGatingConfig,
  QualityGatingDecision,
  EvidenceQualityResult,
} from './types';
import { DEFAULT_QUALITY_GATING_CONFIG } from './types';

/**
 * Applique le quality gating à un résultat d'évaluation
 *
 * @param evaluationResult - Résultat d'évaluation du CV
 * @param config - Configuration du gating
 * @returns Décision (proceed/reject/fallback)
 */
export function applyQualityGating(
  evaluationResult: any,
  config: Partial<QualityGatingConfig> = {}
): QualityGatingDecision {
  const fullConfig: QualityGatingConfig = {
    ...DEFAULT_QUALITY_GATING_CONFIG,
    ...config,
  };

  // 1. Extraire toutes les evidences
  const evidences = extractAllEvidences(evaluationResult);

  if (evidences.length === 0) {
    return {
      approved: false,
      quality_result: {
        total_evidences: 0,
        weak_count: 0,
        medium_count: 0,
        strong_count: 0,
        average_quality: 0,
        quality_percentage: 0,
        scores: [],
        passes_threshold: false,
      },
      reason: 'Aucune evidence trouvée dans le résultat',
      action: fullConfig.enable_fallback ? 'fallback_reextract' : 'reject',
    };
  }

  // 2. Scorer la qualité
  const qualityResult = scoreEvidenceQuality(evidences);

  // 3. Vérifier les seuils
  const checks = {
    average_quality_ok:
      qualityResult.average_quality >= fullConfig.min_average_quality,
    quality_percentage_ok:
      qualityResult.quality_percentage >= fullConfig.min_quality_percentage,
    strong_evidences_ok:
      qualityResult.strong_count >= fullConfig.min_strong_evidences,
  };

  const passes_all = Object.values(checks).every((check) => check === true);

  qualityResult.passes_threshold = passes_all;

  // 4. Décision
  if (passes_all) {
    return {
      approved: true,
      quality_result: qualityResult,
      reason: `Qualité suffisante: ${qualityResult.quality_percentage.toFixed(1)}% (${qualityResult.strong_count} evidences fortes)`,
      action: 'proceed',
    };
  }

  // Qualité insuffisante
  const failedChecks = [];
  if (!checks.average_quality_ok) {
    failedChecks.push(
      `Qualité moyenne trop basse: ${qualityResult.average_quality.toFixed(2)} < ${fullConfig.min_average_quality}`
    );
  }
  if (!checks.quality_percentage_ok) {
    failedChecks.push(
      `Pourcentage qualité trop bas: ${qualityResult.quality_percentage.toFixed(1)}% < ${fullConfig.min_quality_percentage}%`
    );
  }
  if (!checks.strong_evidences_ok) {
    failedChecks.push(
      `Pas assez d'evidences fortes: ${qualityResult.strong_count} < ${fullConfig.min_strong_evidences}`
    );
  }

  const reason = `Qualité insuffisante: ${failedChecks.join('; ')}`;

  return {
    approved: false,
    quality_result: qualityResult,
    reason,
    action: fullConfig.enable_fallback ? 'fallback_reextract' : 'reject',
  };
}

/**
 * Valide la qualité d'un ensemble d'evidences (helper simple)
 */
export function validateEvidenceQuality(
  evidences: Evidence[],
  minQualityPercentage: number = 50
): boolean {
  const result = scoreEvidenceQuality(evidences);
  return result.quality_percentage >= minQualityPercentage;
}

/**
 * Filtre les evidences par score minimum
 */
export function filterEvidencesByQuality(
  evidences: Evidence[],
  minScore: 0 | 1 | 2 = 1
): Evidence[] {
  const result = scoreEvidenceQuality(evidences);
  return result.scores
    .filter((s) => s.quality_score >= minScore)
    .map((s) => s.evidence);
}
