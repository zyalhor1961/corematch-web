/**
 * CV evaluation module (Pass 2)
 */

import pLimit from 'p-limit';
import { analyzeCVWithOpenAI } from '../vendors/openai';
import { analyzeCVWithGemini } from '../vendors/gemini';
import { UNIVERSAL_SYSTEM_PROMPT } from './prompt.system';
import { validateOutput } from '../utils/json';
import { logger } from '../utils/logger';
import type { CV_JSON } from '../extraction/extractor';

const limit = pLimit(3); // Max 3 concurrent calls

export interface RelevanceRules {
  direct: string[];
  adjacent: string[];
  peripheral: string[];
}

export interface JobSpec {
  title: string;
  must_have?: Array<{
    id: string;
    desc: string;
    severity: 'critical' | 'standard';
  }>;
  skills_required?: string[];
  nice_to_have?: string[];
  relevance_rules?: RelevanceRules;
  skills_map?: Record<string, string[]>;
  weights?: {
    w_exp: number;
    w_skills: number;
    w_nice: number;
    p_adjacent: number;
  };
  thresholds?: {
    years_full_score: number;
    shortlist_min: number;
    consider_min: number;
  };
}

export interface EvaluationOutput {
  meets_all_must_have: boolean;
  fails: Array<{
    rule_id: string;
    reason: string;
    evidence: Array<{ quote: string; field_path: string }>;
  }>;
  relevance_summary: {
    months_direct: number;
    months_adjacent: number;
    months_peripheral: number;
    months_non_pertinent: number;
    by_experience: Array<{
      titre: string;
      employeur?: string;
      debut_iso?: string;
      fin_iso?: string | null;
      relevance: 'DIRECTE' | 'ADJACENTE' | 'PERIPHERIQUE' | 'NON_PERTINENTE';
      reason: string;
      evidence: Array<{ quote: string; field_path: string }>;
    }>;
  };
  subscores: {
    experience_years_relevant: number;
    skills_match_0_to_100: number;
    nice_to_have_0_to_100: number;
  };
  overall_score_0_to_100: number;
  recommendation: 'SHORTLIST' | 'CONSIDER' | 'REJECT';
  strengths: Array<{
    point: string;
    evidence: Array<{ quote: string; field_path: string }>;
  }>;
  improvements: Array<{
    point: string;
    why: string;
    suggested_action: string;
  }>;
  evidence_global?: Array<{ quote: string; field_path: string }>;
  debug?: {
    rules_applied?: string;
    computation_details?: Record<string, unknown>;
  };
}

/**
 * Auto-generate relevance rules from job title and skills
 */
function generateDefaultRelevanceRules(jobSpec: JobSpec): RelevanceRules {
  const title = jobSpec.title.toLowerCase();
  const skills = jobSpec.skills_required || [];

  logger.info(`Auto-generating relevance rules for: ${jobSpec.title}`);

  // Generate direct variations (singular/plural, common variations)
  const direct = [
    jobSpec.title,
    title,
    // Add basic variations
    ...title.split(' '),
  ];

  // Generate adjacent based on skill families
  const adjacent: string[] = [];

  // Data-related roles
  if (title.includes('data') || title.includes('analyst') || title.includes('bi')) {
    adjacent.push('BI', 'Business Intelligence', 'Tableau', 'Power BI', 'ETL', 'SQL', 'data stewardship');
  }

  // Development roles
  if (title.includes('developer') || title.includes('dev') || title.includes('engineer')) {
    adjacent.push('software engineer', 'programmer', 'coder', 'tech lead', 'architect');
  }

  // Add skills as adjacent
  adjacent.push(...skills.slice(0, 5));

  // Generate peripheral based on sector
  const peripheral: string[] = [];

  if (title.includes('finance') || title.includes('comptab')) {
    peripheral.push('comptabilité', 'contrôle de gestion', 'audit');
  }

  if (title.includes('tech') || title.includes('IT') || title.includes('informatique')) {
    peripheral.push('support IT', 'infrastructure', 'système');
  }

  return {
    direct: [...new Set(direct)].filter(Boolean),
    adjacent: [...new Set(adjacent)].filter(Boolean),
    peripheral: [...new Set(peripheral)].filter(Boolean)
  };
}

/**
 * Ensure job spec has relevance rules (generate if missing)
 */
function ensureRelevanceRules(jobSpec: JobSpec): JobSpec & { relevance_rules: RelevanceRules; debug_rules_applied: string } {
  let debugRulesApplied = 'provided';

  if (!jobSpec.relevance_rules ||
      (jobSpec.relevance_rules.direct.length === 0 &&
       jobSpec.relevance_rules.adjacent.length === 0 &&
       jobSpec.relevance_rules.peripheral.length === 0)) {

    logger.warn('No relevance_rules provided, generating defaults');
    jobSpec.relevance_rules = generateDefaultRelevanceRules(jobSpec);
    debugRulesApplied = 'auto_generated';
  }

  // Add default weights if missing
  if (!jobSpec.weights) {
    jobSpec.weights = {
      w_exp: 0.5,
      w_skills: 0.3,
      w_nice: 0.2,
      p_adjacent: 0.5
    };
  }

  // Add default thresholds if missing
  if (!jobSpec.thresholds) {
    jobSpec.thresholds = {
      years_full_score: 3,
      shortlist_min: 75,
      consider_min: 60
    };
  }

  return { ...jobSpec, relevance_rules: jobSpec.relevance_rules, debug_rules_applied: debugRulesApplied };
}

/**
 * Evaluate CV with both OpenAI and Gemini (Pass 2)
 */
export async function evaluateCV(
  cvJson: CV_JSON,
  jobSpec: JobSpec
): Promise<{
  openai: EvaluationOutput | null;
  gemini: EvaluationOutput | null;
  errors: { openai?: string; gemini?: string };
}> {
  logger.info('Starting CV evaluation (Pass 2) with both providers');

  // Ensure relevance rules exist
  const enrichedJobSpec = ensureRelevanceRules(jobSpec);

  const errors: { openai?: string; gemini?: string } = {};

  // Run both evaluations in parallel with concurrency limit
  const [openaiResult, geminiResult] = await Promise.allSettled([
    limit(() => analyzeCVWithOpenAI(UNIVERSAL_SYSTEM_PROMPT, cvJson, enrichedJobSpec)),
    limit(() => analyzeCVWithGemini(UNIVERSAL_SYSTEM_PROMPT, cvJson, enrichedJobSpec))
  ]);

  let openaiOutput: EvaluationOutput | null = null;
  let geminiOutput: EvaluationOutput | null = null;

  // Process OpenAI result
  if (openaiResult.status === 'fulfilled') {
    if (validateOutput(openaiResult.value)) {
      openaiOutput = openaiResult.value as EvaluationOutput;
      // Add debug info about rules
      if (!openaiOutput.debug) openaiOutput.debug = {};
      openaiOutput.debug.rules_applied = enrichedJobSpec.debug_rules_applied;
      logger.info('OpenAI evaluation completed successfully');
    } else {
      errors.openai = 'OpenAI output validation failed';
      logger.error('OpenAI output validation failed');
    }
  } else {
    errors.openai = openaiResult.reason?.toString() || 'Unknown error';
    logger.error('OpenAI evaluation failed:', errors.openai);
  }

  // Process Gemini result
  if (geminiResult.status === 'fulfilled') {
    if (validateOutput(geminiResult.value)) {
      geminiOutput = geminiResult.value as EvaluationOutput;
      // Add debug info about rules
      if (!geminiOutput.debug) geminiOutput.debug = {};
      geminiOutput.debug.rules_applied = enrichedJobSpec.debug_rules_applied;
      logger.info('Gemini evaluation completed successfully');
    } else {
      errors.gemini = 'Gemini output validation failed';
      logger.error('Gemini output validation failed');
    }
  } else {
    errors.gemini = geminiResult.reason?.toString() || 'Unknown error';
    logger.error('Gemini evaluation failed:', errors.gemini);
  }

  // Check if at least one succeeded
  if (!openaiOutput && !geminiOutput) {
    throw new Error(`Both providers failed: OpenAI: ${errors.openai}, Gemini: ${errors.gemini}`);
  }

  return {
    openai: openaiOutput,
    gemini: geminiOutput,
    errors
  };
}
