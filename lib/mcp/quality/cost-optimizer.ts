/**
 * Smart Cost Optimizer (MCP Point #6)
 *
 * OBJECTIF: Optimiser les coûts en ajustant automatiquement le mode
 * d'analyse selon la confiance de l'extraction.
 *
 * Stratégie:
 * - Si extraction faible confiance → Upgrade eco→balanced (plus de providers)
 * - Si extraction haute confiance → Downgrade premium→balanced (économie)
 * - Balanced reste stable (équilibre optimal)
 *
 * Seuils par défaut:
 * - Upgrade eco si confiance < 70%
 * - Downgrade premium si confiance > 95%
 *
 * Impact business:
 * - Économie estimée: 20-30% sur coûts
 * - Précision maintenue/améliorée
 */

import type { AnalysisMode } from '@/lib/cv-analysis/types/consensus.types';
import type { CV_JSON } from '@/lib/cv-analysis/types';
import { scoreExtractionConfidence } from './extraction-confidence';
import type {
  ModeAdjustmentDecision,
  CostOptimizerConfig,
  CostMetrics,
  ExtractionConfidenceScore,
} from './types';
import { DEFAULT_COST_OPTIMIZER_CONFIG } from './types';

/**
 * Coûts estimés par mode (en USD)
 */
const MODE_COSTS = {
  eco: 0.005, // 1 provider (gpt-4o-mini ou gemini-flash)
  balanced: 0.013, // 2 providers (gpt-4o + gemini-pro)
  premium: 0.025, // 3 providers (+ claude-sonnet)
};

/**
 * Détermine le mode optimal selon la confiance de l'extraction
 *
 * @param cvJson - CV extrait
 * @param requestedMode - Mode demandé par l'utilisateur
 * @param config - Configuration de l'optimizer
 * @returns Décision d'ajustement avec raison
 */
export function optimizeAnalysisMode(
  cvJson: CV_JSON,
  requestedMode: AnalysisMode,
  config: Partial<CostOptimizerConfig> = {}
): ModeAdjustmentDecision {
  const fullConfig: CostOptimizerConfig = {
    ...DEFAULT_COST_OPTIMIZER_CONFIG,
    ...config,
  };

  // Si auto-adjustment désactivé, garder le mode demandé
  if (!fullConfig.enable_auto_adjustment) {
    const confidenceScore = scoreExtractionConfidence(cvJson);
    return {
      original_mode: requestedMode,
      recommended_mode: requestedMode,
      adjusted: false,
      reason: 'Auto-adjustment désactivé',
      confidence_score: confidenceScore,
    };
  }

  // Calculer la confiance de l'extraction
  const confidenceScore = scoreExtractionConfidence(cvJson);

  // Décision selon le mode demandé
  switch (requestedMode) {
    case 'eco':
      return handleEcoMode(confidenceScore, fullConfig);

    case 'premium':
      return handlePremiumMode(confidenceScore, fullConfig);

    case 'balanced':
      // Balanced reste toujours balanced (équilibre optimal)
      return {
        original_mode: 'balanced',
        recommended_mode: 'balanced',
        adjusted: false,
        reason: 'Mode balanced optimal par défaut',
        confidence_score: confidenceScore,
      };

    default:
      return {
        original_mode: requestedMode,
        recommended_mode: requestedMode,
        adjusted: false,
        reason: 'Mode inconnu',
        confidence_score: confidenceScore,
      };
  }
}

/**
 * Gestion du mode eco
 */
function handleEcoMode(
  confidence: ExtractionConfidenceScore,
  config: CostOptimizerConfig
): ModeAdjustmentDecision {
  // Si confiance trop basse, upgrade vers balanced
  if (confidence.overall_confidence < config.upgrade_eco_threshold) {
    return {
      original_mode: 'eco',
      recommended_mode: 'balanced',
      adjusted: true,
      reason: `Confiance extraction trop basse (${confidence.overall_confidence}% < ${config.upgrade_eco_threshold}%). Upgrade eco→balanced pour améliorer précision.`,
      confidence_score: confidence,
    };
  }

  // Confiance suffisante, garder eco
  return {
    original_mode: 'eco',
    recommended_mode: 'eco',
    adjusted: false,
    reason: `Confiance extraction suffisante (${confidence.overall_confidence}%). Mode eco approprié.`,
    confidence_score: confidence,
  };
}

/**
 * Gestion du mode premium
 */
function handlePremiumMode(
  confidence: ExtractionConfidenceScore,
  config: CostOptimizerConfig
): ModeAdjustmentDecision {
  // Si confiance très haute, downgrade vers balanced
  if (confidence.overall_confidence > config.downgrade_premium_threshold) {
    return {
      original_mode: 'premium',
      recommended_mode: 'balanced',
      adjusted: true,
      reason: `Confiance extraction très haute (${confidence.overall_confidence}% > ${config.downgrade_premium_threshold}%). Downgrade premium→balanced pour économiser sans perte de précision.`,
      confidence_score: confidence,
    };
  }

  // Confiance moyenne/basse, garder premium
  return {
    original_mode: 'premium',
    recommended_mode: 'premium',
    adjusted: false,
    reason: `Confiance extraction moyenne (${confidence.overall_confidence}%). Mode premium justifié.`,
    confidence_score: confidence,
  };
}

/**
 * Calcule les métriques de coût et économies
 */
export function calculateCostMetrics(
  decision: ModeAdjustmentDecision
): CostMetrics {
  const cost_original = MODE_COSTS[decision.original_mode];
  const cost_adjusted = MODE_COSTS[decision.recommended_mode];
  const savings = cost_original - cost_adjusted;
  const savings_percentage =
    cost_original > 0 ? (savings / cost_original) * 100 : 0;

  return {
    mode_original: decision.original_mode,
    mode_adjusted: decision.recommended_mode,
    estimated_cost_original_usd: cost_original,
    estimated_cost_adjusted_usd: cost_adjusted,
    savings_usd: savings,
    savings_percentage,
  };
}

/**
 * Recommandation de mode pour un CV donné (helper simple)
 */
export function recommendMode(cvJson: CV_JSON): AnalysisMode {
  const confidence = scoreExtractionConfidence(cvJson);

  if (confidence.overall_confidence >= 80) {
    return 'eco'; // Haute confiance → eco suffisant
  } else if (confidence.overall_confidence >= 60) {
    return 'balanced'; // Confiance moyenne → balanced
  } else {
    return 'premium'; // Faible confiance → premium nécessaire
  }
}
