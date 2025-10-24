/**
 * Configuration des modes d'analyse
 * Éco / Équilibré / Premium
 */

import type { AnalysisMode, AnalysisModeConfig } from '../types';

/**
 * Configuration des 3 modes d'analyse
 */
export const ANALYSIS_MODES: Record<AnalysisMode, AnalysisModeConfig> = {
  eco: {
    mode: 'eco',
    description: '1 modèle unique, rapide et économique',
    providers_count: 1,
    uses_arbiter: false,
    estimated_cost_multiplier: 1.0,
    estimated_latency_ms: 5000,
  },

  balanced: {
    mode: 'balanced',
    description: '1 modèle + validation conditionnelle si incertitude',
    providers_count: 1, // 1-2 selon triggers
    uses_arbiter: true, // Seulement si triggers activés
    estimated_cost_multiplier: 1.3, // 30% des CVs en multi-provider
    estimated_latency_ms: 7000,
  },

  premium: {
    mode: 'premium',
    description: '2-3 modèles + arbitre systématique pour maximum de fiabilité',
    providers_count: 3,
    uses_arbiter: true,
    estimated_cost_multiplier: 3.5,
    estimated_latency_ms: 15000,
  },
};

/**
 * Seuils pour déclencher l'analyse multi-provider en mode Équilibré
 */
export const UNCERTAINTY_THRESHOLDS = {
  // Score borderline: entre consider_min et shortlist_min
  borderline_zone: true,

  // Écart entre sous-scores
  subscore_divergence_threshold: 25, // Si |exp - skills| > 25 pts

  // Nombre minimum de preuves solides
  min_evidence_count: 3,

  // Confiance minimum du modèle
  min_confidence: 0.7, // 70%

  // Seuil pour "must_have incertain"
  must_have_weak_evidence_threshold: 2, // < 2 preuves = incertain
} as const;

/**
 * Configuration par défaut pour nouveaux projets
 */
export const DEFAULT_MODE: AnalysisMode = 'balanced';

/**
 * Helper: obtenir la config d'un mode
 */
export function getModeConfig(mode: AnalysisMode): AnalysisModeConfig {
  return ANALYSIS_MODES[mode];
}

/**
 * Helper: calculer le coût estimé pour N CVs
 */
export function estimateCost(
  mode: AnalysisMode,
  cvCount: number,
  baseCostPerCV: number = 0.05 // 5 centimes en mode eco
): { total: number; perCV: number } {
  const config = getModeConfig(mode);
  const perCV = baseCostPerCV * config.estimated_cost_multiplier;
  const total = perCV * cvCount;

  return { total, perCV };
}

/**
 * Helper: vérifier si un mode est valide
 */
export function isValidMode(mode: string): mode is AnalysisMode {
  return mode === 'eco' || mode === 'balanced' || mode === 'premium';
}
