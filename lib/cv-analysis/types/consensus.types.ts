/**
 * Types pour le système multi-provider et consensus
 * Agrégation, arbitrage, désaccords
 */

import type { EvaluationResult } from './evaluation.types';
import type { ContextSnapshot } from '@/lib/mcp/types/context-snapshot';

// ============================================================================
// Modes d'analyse
// ============================================================================

export type AnalysisMode = 'eco' | 'balanced' | 'premium';

export interface AnalysisModeConfig {
  mode: AnalysisMode;
  description: string;
  providers_count: number;
  uses_arbiter: boolean;
  estimated_cost_multiplier: number;
  estimated_latency_ms: number;
}

// ============================================================================
// Providers
// ============================================================================

export type ProviderName = 'openai' | 'gemini' | 'claude';

export interface ProviderConfig {
  name: ProviderName;
  model: string;
  temperature: number;
  max_tokens?: number;
  weight: number; // Pondération dans l'agrégation (0-1)
}

export interface ProviderResult {
  provider: ProviderName;
  model: string;
  result: EvaluationResult | null;
  error?: string;
  execution_time_ms: number;
  tokens_used?: {
    input: number;
    output: number;
  };
  cost_usd?: number;
}

// ============================================================================
// Consensus et désaccords
// ============================================================================

export type ConsensusLevel = 'strong' | 'medium' | 'weak' | 'none';

export interface ModelDisagreement {
  field: string;
  values: Record<ProviderName, any>;
  delta?: number; // Pour les valeurs numériques
  severity: 'minor' | 'moderate' | 'major';
}

export interface ConsensusMetrics {
  level: ConsensusLevel;
  delta_overall_score: number;
  delta_subscores: {
    experience: number;
    skills: number;
    nice_to_have: number;
  };
  agreement_rate: number; // 0-1
  disagreements_count: number;
}

// ============================================================================
// Pré-filtre (Stage 0)
// ============================================================================

export interface PrefilterResult {
  pass: boolean;
  confidence: number; // 0-1
  soft_flags: Record<string, number>; // flag_name → severity (0-1)
  reasons: string[];
  execution_time_ms: number;
}

// ============================================================================
// Context Packing (compression tokens)
// ============================================================================

export interface PackedSection {
  type: 'experience' | 'skill' | 'formation' | 'certification';
  index?: number;
  relevance_score: number;
  content: string;
}

export interface PackedContext {
  top_sections: PackedSection[];
  citations: string[];
  original_size_bytes: number;
  compressed_size_bytes: number;
  compression_ratio: number;
  fallback_to_full: boolean;
}

// ============================================================================
// Agrégation quantitative
// ============================================================================

export interface QuantitativeAggregate {
  meets_all_must_have: boolean;
  overall_score_0_to_100: number;
  recommendation: 'SHORTLIST' | 'CONSIDER' | 'REJECT';
  subscores: {
    experience_years_relevant: number;
    skills_match_0_to_100: number;
    nice_to_have_0_to_100: number;
  };
  aggregation_method: 'weighted_average' | 'vote' | 'union';
  weights_used: Record<ProviderName, number>;
}

// ============================================================================
// Arbitre (juge LLM)
// ============================================================================

export interface ArbiterInput {
  providers_raw: Record<ProviderName, EvaluationResult>;
  quantitative_aggregate: QuantitativeAggregate;
  disagreements: ModelDisagreement[];
  job_spec_title: string;
}

export interface ArbiterOutput {
  final_decision: EvaluationResult;
  justification: string;
  arbitrage_summary: string;
  resolved_disagreements: Array<{
    field: string;
    chosen_value: any;
    reason: string;
  }>;
  execution_time_ms: number;
  tokens_used?: {
    input: number;
    output: number;
  };
}

// ============================================================================
// Résultat final agrégé
// ============================================================================

export interface AggregatedResult {
  // Décision finale
  final_decision: EvaluationResult;

  // Traçabilité: résultats bruts de chaque provider
  providers_raw: Record<ProviderName, EvaluationResult | null>;

  // Consensus et métriques
  consensus: ConsensusMetrics;

  // Arbitrage (si mode balanced/premium)
  arbiter?: ArbiterOutput;

  // Debug et traçabilité
  debug: {
    mode: AnalysisMode;
    providers_used: ProviderName[];
    aggregation_method: string;
    model_disagreements: ModelDisagreement[];
    early_exit: boolean;
    reasons_for_multi_provider?: string[];
  };

  // Coûts et performance
  performance: {
    total_execution_time_ms: number;
    prefilter_time_ms?: number;
    extraction_time_ms: number;
    evaluation_time_ms: number;
    aggregation_time_ms?: number;
    arbiter_time_ms?: number;
  };

  cost: {
    total_usd: number;
    by_provider: Record<ProviderName, number>;
    by_stage: {
      extraction: number;
      evaluation: number;
      arbiter?: number;
    };
  };

  // ✅ NOUVEAU: Context snapshot pour traçabilité et audit MCP
  context_snapshot: ContextSnapshot;
}

// ============================================================================
// Triggers pour mode balanced (needsMore)
// ============================================================================

export interface UncertaintyTriggers {
  borderline_score: boolean;
  weak_evidence: boolean;
  score_divergence: boolean;
  must_have_uncertain: boolean;
  vip_candidate: boolean;
}

export interface NeedsMoreAnalysis {
  needs_more: boolean;
  triggers: UncertaintyTriggers;
  confidence: number; // 0-1
  recommended_providers: ProviderName[];
}
