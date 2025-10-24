/**
 * Utilitaires centralisés pour l'analyse CV
 *
 * Exports:
 * - dates.ts: Gestion des dates et périodes
 * - normalize.ts: Normalisation de texte et compétences
 */

// Export dates
export {
  getAnalysisDate,
  toYearMonth,
  parseYearMonth,
  normalizeEndDate,
  calculateMonths,
  mergePeriods,
  calculateTotalMonths,
  periodsOverlap,
  isValidYearMonth,
  yearsFromDate,
  formatDuration,
} from './dates';

export type { Period } from './dates';

// Export normalize
export {
  normalizeText,
  tokenize,
  removeStopWords,
  simpleLemmatize,
  normalizeSkill,
  skillsMatch,
  cleanText,
  extractKeywords,
  jaccardSimilarity,
  findMatchingSkills,
  countOccurrences,
} from './normalize';
