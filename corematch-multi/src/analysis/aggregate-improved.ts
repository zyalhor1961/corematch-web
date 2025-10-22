/**
 * Improved Aggregation with critical enhancements
 */

import { logger } from '../utils/logger';
import type { EvaluationOutput } from './evaluator';
import type { ModelDisagreement, AggregatedResult } from './aggregate';

/**
 * Extract ADJACENTE experiences as automatic strengths
 */
function extractAdjacentStrengths(
  openaiResult: EvaluationOutput,
  geminiResult: EvaluationOutput
): Array<{ point: string; evidence: Array<{ quote: string; field_path: string }> }> {
  const adjacentStrengths: Array<{ point: string; evidence: Array<{ quote: string; field_path: string }> }> = [];

  // Combine experiences from both results
  const allExperiences = [
    ...(openaiResult.relevance_summary.by_experience || []),
    ...(geminiResult.relevance_summary.by_experience || [])
  ];

  // Filter ADJACENTE experiences
  const adjacentExps = allExperiences.filter(exp => exp.relevance === 'ADJACENTE');

  // Deduplicate by titre
  const seen = new Set<string>();
  for (const exp of adjacentExps) {
    if (!seen.has(exp.titre)) {
      seen.add(exp.titre);
      adjacentStrengths.push({
        point: `Expérience adjacente pertinente: ${exp.titre}`,
        evidence: exp.evidence || []
      });
    }
  }

  return adjacentStrengths;
}

/**
 * Filter out improvements that concern adjacent experiences
 */
function filterAdjacentImprovements(
  improvements: Array<{ point: string; why: string; suggested_action: string }>,
  adjacentExperiences: Set<string>
): Array<{ point: string; why: string; suggested_action: string }> {
  return improvements.filter(imp => {
    const lowerPoint = imp.point.toLowerCase();
    const lowerWhy = imp.why.toLowerCase();

    // Check if improvement mentions adjacent keywords
    const mentionsAdjacent =
      lowerPoint.includes('adjacent') ||
      lowerWhy.includes('adjacent') ||
      lowerPoint.includes('transférable') ||
      lowerWhy.includes('transférable');

    // Check if improvement mentions any adjacent experience title
    const mentionsAdjacentExp = Array.from(adjacentExperiences).some(expTitle =>
      lowerPoint.includes(expTitle.toLowerCase()) ||
      lowerWhy.includes(expTitle.toLowerCase())
    );

    // Keep if doesn't mention adjacent
    return !mentionsAdjacent && !mentionsAdjacentExp;
  });
}

/**
 * Check if ANY fail has critical severity
 * Looks for severity field or critical keyword in rule_id
 */
function hasCriticalFailure(
  openaiResult: EvaluationOutput,
  geminiResult: EvaluationOutput
): boolean {
  const allFails = [...openaiResult.fails, ...geminiResult.fails];

  return allFails.some(fail => {
    // Check if fail object has severity field
    if ('severity' in fail && fail.severity === 'critical') {
      return true;
    }

    // Fallback: check rule_id contains 'critical' or 'M' (critical must-have IDs usually start with M)
    const isCritical =
      fail.rule_id.toLowerCase().includes('critical') ||
      (fail.rule_id.startsWith('M') && fail.reason.toLowerCase().includes('critique'));

    if (isCritical) {
      logger.warn(`[Aggregator] Critical must-have failed: ${fail.rule_id} - ${fail.reason}`);
    }

    return isCritical;
  });
}

/**
 * Improved aggregation with critical enhancements
 */
export function aggregateResultsImproved(
  openai: EvaluationOutput | null,
  gemini: EvaluationOutput | null,
  originalAggregate: (o: EvaluationOutput | null, g: EvaluationOutput | null) => AggregatedResult
): AggregatedResult {
  // Use original aggregation first
  const result = originalAggregate(openai, gemini);

  // Only enhance if we have both results
  if (!openai || !gemini) {
    return result;
  }

  // Enhancement 1: Force REJECT for critical failures
  const criticalFailure = hasCriticalFailure(openai, gemini);
  if (criticalFailure && result.final_decision.recommendation !== 'REJECT') {
    logger.warn('[Aggregator] Forcing REJECT due to critical must-have failure');
    result.final_decision.recommendation = 'REJECT';
  }

  // Enhancement 2: Add ADJACENTE experiences as strengths
  const adjacentStrengths = extractAdjacentStrengths(openai, gemini);

  // Collect adjacent experience titles for filtering
  const adjacentTitles = new Set<string>();
  [...openai.relevance_summary.by_experience, ...gemini.relevance_summary.by_experience]
    .filter(exp => exp.relevance === 'ADJACENTE')
    .forEach(exp => adjacentTitles.add(exp.titre));

  // Merge with existing strengths (deduplicate)
  const existingPoints = new Set(result.final_decision.strengths.map(s => s.point));
  for (const strength of adjacentStrengths) {
    if (!existingPoints.has(strength.point)) {
      result.final_decision.strengths.push(strength);
    }
  }

  // Enhancement 3: Filter out improvements about adjacent experiences
  result.final_decision.improvements = filterAdjacentImprovements(
    result.final_decision.improvements,
    adjacentTitles
  );

  logger.info(`[Aggregator] Enhanced: +${adjacentStrengths.length} adjacent strengths, filtered improvements`);

  return result;
}
