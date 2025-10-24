/**
 * Règles métier pour l'analyse CV
 *
 * Exports:
 * - relevance-rules.ts: Évaluation pertinence expériences
 * - must-have-evaluator.ts: Évaluation règles obligatoires
 * - skills-map.ts: Synonymes et matching de compétences
 */

export {
  evaluateExperienceRelevance,
  evaluateAllExperiences,
} from './relevance-rules';

export {
  evaluateMustHaveRules,
} from './must-have-evaluator';

export {
  SKILLS_ALIASES,
  addSkillAlias,
  getSkillAliases,
  skillsMatch,
  matchSkills,
  enrichJobSpecWithAliases,
} from './skills-map';
