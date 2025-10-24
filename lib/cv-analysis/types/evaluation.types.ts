/**
 * Types pour l'évaluation de candidatures
 * Règles métier, scoring, recommandations
 */

// ============================================================================
// JobSpec - Spécification du poste
// ============================================================================

export interface MustHaveRule {
  id: string;
  desc: string;
  severity: 'critical' | 'standard';
}

export interface RelevanceRules {
  direct: string[];
  adjacent: string[];
  peripheral: string[];
}

export interface Weights {
  w_exp: number;
  w_skills: number;
  w_nice: number;
  p_adjacent: number; // Poids pour expériences adjacentes (0-1)
}

export interface Thresholds {
  years_full_score: number;
  shortlist_min: number;
  consider_min: number;
}

export interface JobSpec {
  title: string;
  must_have: MustHaveRule[];
  skills_required: string[];
  nice_to_have: string[];
  relevance_rules: RelevanceRules;
  skills_map?: Record<string, string[]>; // Synonymes/alias
  weights?: Weights;
  thresholds?: Thresholds;
  analysis_date?: string; // YYYY-MM-DD
}

// ============================================================================
// Evidence - Preuves et citations
// ============================================================================

export interface Evidence {
  quote: string;
  field_path: string;
}

/**
 * Qualité d'une preuve (0-2)
 * 0 = vague ("a de l'expérience")
 * 1 = précis ("3 ans React")
 * 2 = citation exacte avec field_path
 */
export interface EvidenceQualityScore {
  evidence: Evidence;
  quality_score: 0 | 1 | 2;
  reason: string;
}

// ============================================================================
// Échecs et règles
// ============================================================================

export interface FailedRule {
  rule_id: string;
  reason: string;
  evidence: Evidence[];
}

// ============================================================================
// Pertinence et expériences
// ============================================================================

export type RelevanceLevel = 'DIRECTE' | 'ADJACENTE' | 'PERIPHERIQUE' | 'NON_PERTINENTE';

export interface ExperienceRelevance {
  index: number;
  titre: string;
  employeur?: string;
  start?: string; // YYYY-MM
  end?: string | null; // YYYY-MM or null for current
  relevance: RelevanceLevel;
  reason: string;
  evidence: Evidence[];
}

export interface RelevanceSummary {
  months_direct: number;
  months_adjacent: number;
  months_peripheral: number;
  months_non_pertinent: number;
  by_experience: ExperienceRelevance[];
}

// ============================================================================
// Scoring
// ============================================================================

export interface Subscores {
  experience_years_relevant: number;
  skills_match_0_to_100: number;
  nice_to_have_0_to_100: number;
}

// ============================================================================
// Forces et axes d'amélioration
// ============================================================================

export interface Strength {
  point: string;
  evidence: Evidence[];
}

export interface Improvement {
  point: string;
  why: string;
  suggested_action: string;
}

// ============================================================================
// Résultat d'évaluation
// ============================================================================

export type Recommendation = 'SHORTLIST' | 'CONSIDER' | 'REJECT';

export interface EvaluationResult {
  meets_all_must_have: boolean;
  fails: FailedRule[];
  relevance_summary: RelevanceSummary;
  subscores: Subscores;
  overall_score_0_to_100: number;
  recommendation: Recommendation;
  strengths: Strength[];
  improvements: Improvement[];
  evidence_global?: Evidence[];
}

// ============================================================================
// Métadonnées d'évaluation
// ============================================================================

export interface EvaluationMetadata {
  evaluated_at: string; // ISO 8601
  evaluator_model: string;
  evaluation_version: string;
  execution_time_ms: number;
  tokens_used?: {
    input: number;
    output: number;
  };
}
