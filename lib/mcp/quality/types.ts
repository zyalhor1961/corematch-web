/**
 * Types pour Quality Gating & Cost Optimization (MCP Points #5 et #6)
 */

import type { Evidence } from '@/lib/cv-analysis/types';
import type { AnalysisMode } from '@/lib/cv-analysis/types/consensus.types';

// ============================================================================
// Point #5: Evidence Quality Gating
// ============================================================================

/**
 * Score de qualité d'une evidence (0-2)
 * 0 = weak: Vague, pas de citation ("a de l'expérience")
 * 1 = medium: Précis mais sans citation exacte ("3 ans React")
 * 2 = strong: Citation exacte avec field_path
 */
export interface EvidenceQualityScore {
  evidence: Evidence;
  quality_score: 0 | 1 | 2;
  reason: string;
}

/**
 * Résultat de l'évaluation de qualité des evidences
 */
export interface EvidenceQualityResult {
  total_evidences: number;
  weak_count: number; // score 0
  medium_count: number; // score 1
  strong_count: number; // score 2
  average_quality: number; // 0-2
  quality_percentage: number; // 0-100 (normalized)
  scores: EvidenceQualityScore[];
  passes_threshold: boolean;
}

/**
 * Configuration du quality gating
 */
export interface QualityGatingConfig {
  /** Seuil minimum de qualité moyenne (0-2) */
  min_average_quality: number;
  /** Seuil minimum de pourcentage de qualité (0-100) */
  min_quality_percentage: number;
  /** Nombre minimum d'evidences strong (score 2) */
  min_strong_evidences: number;
  /** Autoriser le fallback vers extraction améliorée si échec */
  enable_fallback: boolean;
}

/**
 * Résultat du quality gating avec décision
 */
export interface QualityGatingDecision {
  approved: boolean;
  quality_result: EvidenceQualityResult;
  reason: string;
  action: 'proceed' | 'reject' | 'fallback_reextract';
}

// ============================================================================
// Point #6: Smart Cost Triggering
// ============================================================================

/**
 * Score de confiance de l'extraction (0-100)
 */
export interface ExtractionConfidenceScore {
  overall_confidence: number; // 0-100
  identity_confidence: number; // 0-100
  experiences_confidence: number; // 0-100
  formations_confidence: number; // 0-100
  competences_confidence: number; // 0-100
  missing_fields: string[];
  issues: string[];
}

/**
 * Décision d'ajustement du mode d'analyse
 */
export interface ModeAdjustmentDecision {
  original_mode: AnalysisMode;
  recommended_mode: AnalysisMode;
  adjusted: boolean;
  reason: string;
  confidence_score: ExtractionConfidenceScore;
}

/**
 * Configuration du cost optimizer
 */
export interface CostOptimizerConfig {
  /** Seuil confiance pour upgrade eco→balanced */
  upgrade_eco_threshold: number; // Default: 70
  /** Seuil confiance pour downgrade premium→balanced */
  downgrade_premium_threshold: number; // Default: 95
  /** Activer l'auto-adjustment */
  enable_auto_adjustment: boolean;
}

/**
 * Métriques de coût et économies
 */
export interface CostMetrics {
  mode_original: AnalysisMode;
  mode_adjusted: AnalysisMode;
  estimated_cost_original_usd: number;
  estimated_cost_adjusted_usd: number;
  savings_usd: number;
  savings_percentage: number;
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_QUALITY_GATING_CONFIG: QualityGatingConfig = {
  min_average_quality: 1.0, // Au moins 50% de qualité
  min_quality_percentage: 50,
  min_strong_evidences: 1, // Au moins 1 evidence forte
  enable_fallback: true,
};

export const DEFAULT_COST_OPTIMIZER_CONFIG: CostOptimizerConfig = {
  upgrade_eco_threshold: 70, // Si confiance < 70%, upgrade eco→balanced
  downgrade_premium_threshold: 95, // Si confiance > 95%, downgrade premium→balanced
  enable_auto_adjustment: true,
};
