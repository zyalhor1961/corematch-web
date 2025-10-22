/**
 * Aggregation and consensus scoring module
 */

import { logger } from '../utils/logger';
import type { EvaluationOutput } from './evaluator';

export interface ModelDisagreement {
  field: string;
  openai_value: unknown;
  gemini_value: unknown;
  delta?: number;
}

export interface AggregatedResult {
  final_decision: EvaluationOutput;
  providers_raw: {
    openai?: EvaluationOutput;
    gemini?: EvaluationOutput;
  };
  consensus: 'fort' | 'moyen' | 'faible';
  debug: {
    model_disagreements: ModelDisagreement[];
    providers_used: string[];
    aggregation_method: string;
  };
}

/**
 * Calculate consensus level based on score differences
 */
function calculateConsensus(
  openai: EvaluationOutput | null,
  gemini: EvaluationOutput | null
): 'fort' | 'moyen' | 'faible' {
  if (!openai || !gemini) {
    return 'faible'; // Only one provider = low consensus
  }

  const scoreDelta = Math.abs(
    openai.overall_score_0_to_100 - gemini.overall_score_0_to_100
  );

  const recommendationMatch = openai.recommendation === gemini.recommendation;

  if (scoreDelta < 5 && recommendationMatch) {
    return 'fort'; // Strong consensus: scores within 5 points and same recommendation
  } else if (scoreDelta < 15 || recommendationMatch) {
    return 'moyen'; // Medium consensus: scores within 15 points OR same recommendation
  } else {
    return 'faible'; // Weak consensus: significant disagreement
  }
}

/**
 * Track disagreements between models
 */
function trackDisagreements(
  openai: EvaluationOutput | null,
  gemini: EvaluationOutput | null
): ModelDisagreement[] {
  if (!openai || !gemini) return [];

  const disagreements: ModelDisagreement[] = [];

  // Check overall score (threshold: 10 points)
  const scoreDelta = Math.abs(
    openai.overall_score_0_to_100 - gemini.overall_score_0_to_100
  );
  if (scoreDelta > 10) {
    disagreements.push({
      field: 'overall_score_0_to_100',
      openai_value: openai.overall_score_0_to_100,
      gemini_value: gemini.overall_score_0_to_100,
      delta: scoreDelta
    });
  }

  // Check recommendation
  if (openai.recommendation !== gemini.recommendation) {
    disagreements.push({
      field: 'recommendation',
      openai_value: openai.recommendation,
      gemini_value: gemini.recommendation
    });
  }

  // Check must_have
  if (openai.meets_all_must_have !== gemini.meets_all_must_have) {
    disagreements.push({
      field: 'meets_all_must_have',
      openai_value: openai.meets_all_must_have,
      gemini_value: gemini.meets_all_must_have
    });
  }

  // Check skills match (threshold: 10 points)
  const skillsDelta = Math.abs(
    openai.subscores.skills_match_0_to_100 - gemini.subscores.skills_match_0_to_100
  );
  if (skillsDelta > 10) {
    disagreements.push({
      field: 'subscores.skills_match_0_to_100',
      openai_value: openai.subscores.skills_match_0_to_100,
      gemini_value: gemini.subscores.skills_match_0_to_100,
      delta: skillsDelta
    });
  }

  return disagreements;
}

/**
 * Aggregate two evaluation results with weighted averaging
 * OpenAI: 55%, Gemini: 45%
 */
export function aggregateResults(
  openai: EvaluationOutput | null,
  gemini: EvaluationOutput | null
): AggregatedResult {
  logger.info('Starting result aggregation');

  // Determine aggregation method
  let aggregationMethod: string;
  let providersUsed: string[];

  if (openai && gemini) {
    aggregationMethod = 'weighted_average';
    providersUsed = ['openai', 'gemini'];
  } else if (openai) {
    aggregationMethod = 'fallback_openai';
    providersUsed = ['openai'];
    logger.warn('Using OpenAI result only (Gemini failed)');
  } else if (gemini) {
    aggregationMethod = 'fallback_gemini';
    providersUsed = ['gemini'];
    logger.warn('Using Gemini result only (OpenAI failed)');
  } else {
    throw new Error('Both providers failed');
  }

  // Fallback: use single provider result
  if (!openai && gemini) {
    return {
      final_decision: gemini,
      providers_raw: { gemini },
      consensus: 'faible',
      debug: {
        model_disagreements: [],
        providers_used: providersUsed,
        aggregation_method: aggregationMethod
      }
    };
  }

  if (openai && !gemini) {
    return {
      final_decision: openai,
      providers_raw: { openai },
      consensus: 'faible',
      debug: {
        model_disagreements: [],
        providers_used: providersUsed,
        aggregation_method: aggregationMethod
      }
    };
  }

  // Both providers available - aggregate with weights
  const o = openai!;
  const g = gemini!;

  const aggregated: EvaluationOutput = {
    // meets_all_must_have: AND logic
    meets_all_must_have: o.meets_all_must_have && g.meets_all_must_have,

    // fails: Union (deduplicated by rule_id)
    fails: [
      ...o.fails,
      ...g.fails.filter(gf => !o.fails.some(of => of.rule_id === gf.rule_id))
    ],

    // relevance_summary: Average months (rounded)
    relevance_summary: {
      months_direct: Math.round(
        (o.relevance_summary.months_direct + g.relevance_summary.months_direct) / 2
      ),
      months_adjacent: Math.round(
        (o.relevance_summary.months_adjacent + g.relevance_summary.months_adjacent) / 2
      ),
      months_peripheral: Math.round(
        (o.relevance_summary.months_peripheral + g.relevance_summary.months_peripheral) / 2
      ),
      months_non_pertinent: Math.round(
        (o.relevance_summary.months_non_pertinent + g.relevance_summary.months_non_pertinent) / 2
      ),
      // Use OpenAI's by_experience (or merge if needed)
      by_experience: o.relevance_summary.by_experience
    },

    // subscores: Weighted average (OpenAI 55%, Gemini 45%)
    subscores: {
      experience_years_relevant: Number(
        (0.55 * o.subscores.experience_years_relevant +
         0.45 * g.subscores.experience_years_relevant).toFixed(1)
      ),
      skills_match_0_to_100: Math.round(
        0.55 * o.subscores.skills_match_0_to_100 +
        0.45 * g.subscores.skills_match_0_to_100
      ),
      nice_to_have_0_to_100: Math.round(
        0.55 * o.subscores.nice_to_have_0_to_100 +
        0.45 * g.subscores.nice_to_have_0_to_100
      )
    },

    // overall_score: Weighted average
    overall_score_0_to_100: Number(
      (0.55 * o.overall_score_0_to_100 +
       0.45 * g.overall_score_0_to_100).toFixed(1)
    ),

    // recommendation: Vote with priority SHORTLIST > CONSIDER > REJECT
    recommendation: (() => {
      // Check for critical must_have failures
      const hasCriticalFail = [...o.fails, ...g.fails].some(f =>
        f.rule_id.includes('critical')
      );
      if (hasCriticalFail) return 'REJECT';

      // Vote logic
      if (o.recommendation === 'SHORTLIST' || g.recommendation === 'SHORTLIST') {
        return 'SHORTLIST';
      }
      if (o.recommendation === 'CONSIDER' || g.recommendation === 'CONSIDER') {
        return 'CONSIDER';
      }
      return 'REJECT';
    })(),

    // strengths: Concatenation (deduplicated by point)
    strengths: [
      ...o.strengths,
      ...g.strengths.filter(gs => !o.strengths.some(os => os.point === gs.point))
    ],

    // improvements: Concatenation (deduplicated by point)
    improvements: [
      ...o.improvements,
      ...g.improvements.filter(gi => !o.improvements.some(oi => oi.point === gi.point))
    ],

    // evidence_global: Merge if present
    evidence_global: [
      ...(o.evidence_global || []),
      ...(g.evidence_global || [])
    ],

    // debug: Combine
    debug: {
      rules_applied: o.debug?.rules_applied || g.debug?.rules_applied || 'unknown',
      computation_details: {
        ...(o.debug?.computation_details || {}),
        ...(g.debug?.computation_details || {})
      }
    }
  };

  const disagreements = trackDisagreements(o, g);
  const consensus = calculateConsensus(o, g);

  logger.info(`Aggregation completed: ${providersUsed.join(' + ')}, consensus: ${consensus}, disagreements: ${disagreements.length}`);

  return {
    final_decision: aggregated,
    providers_raw: { openai: o, gemini: g },
    consensus,
    debug: {
      model_disagreements: disagreements,
      providers_used: providersUsed,
      aggregation_method: aggregationMethod
    }
  };
}
