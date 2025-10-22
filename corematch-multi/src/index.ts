/**
 * CoreMatch Multi-Provider CV Analysis
 * Main entry point
 */

import { extractCV } from './extraction/extractor';
import { evaluateCV } from './analysis/evaluator';
import { aggregateResults } from './analysis/aggregate';
import { aggregateResultsImproved } from './analysis/aggregate-improved';
import { logger } from './utils/logger';
import { initValidators } from './utils/json';
import type { CV_JSON } from './extraction/extractor';
import type { JobSpec } from './analysis/evaluator';
import type { AggregatedResult } from './analysis/aggregate';

// Initialize validators on startup
initValidators();

/**
 * Main analysis function
 * Performs 3-pass analysis: Extraction → Evaluation → Aggregation
 */
export async function analyzeCV(
  cvText: string,
  jobSpec: JobSpec
): Promise<AggregatedResult> {
  logger.info('=== Starting Multi-Provider CV Analysis ===');
  logger.info(`Job: ${jobSpec.title}`);
  logger.info(`CV length: ${cvText.length} characters`);

  try {
    // Pass 1: Extract CV with OpenAI gpt-4o-mini
    logger.info('--- Pass 1: CV Extraction ---');
    const cvJson = await extractCV(cvText);
    logger.info(`Extracted: ${cvJson.experiences.length} experiences, ${cvJson.competences.length} skills`);

    // Pass 2: Evaluate with both OpenAI and Gemini in parallel
    logger.info('--- Pass 2: Parallel Evaluation ---');
    const { openai, gemini, errors } = await evaluateCV(cvJson, jobSpec);

    if (errors.openai) {
      logger.warn(`OpenAI error: ${errors.openai}`);
    }
    if (errors.gemini) {
      logger.warn(`Gemini error: ${errors.gemini}`);
    }

    // Pass 3: Aggregate results with improvements
    logger.info('--- Pass 3: Aggregation (Enhanced) ---');
    const result = aggregateResultsImproved(openai, gemini, aggregateResults);

    logger.info('=== Analysis Complete ===');
    logger.info(`Recommendation: ${result.final_decision.recommendation}`);
    logger.info(`Score: ${result.final_decision.overall_score_0_to_100}`);
    logger.info(`Consensus: ${result.consensus}`);
    logger.info(`Disagreements: ${result.debug.model_disagreements.length}`);

    return result;

  } catch (error) {
    logger.error('Analysis failed:', error);
    throw error;
  }
}

// Export types
export type { CV_JSON, JobSpec, AggregatedResult };
export { extractCV, evaluateCV, aggregateResults, aggregateResultsImproved };

// Export utilities
export {
  skillsMatch,
  calculateSkillsMatch,
  normalizeSkill,
  getSkillVariants,
  addSkillAlias
} from './utils/skills-normalizer';
