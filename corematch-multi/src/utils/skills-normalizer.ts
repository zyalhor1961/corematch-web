/**
 * Skills normalizer for better matching
 * Handles lowercase, accents, lemmatization, and aliases
 */

/**
 * Common skills aliases map
 */
const SKILLS_ALIASES: Record<string, string[]> = {
  // Programming languages
  'javascript': ['js', 'ecmascript', 'es6', 'es2015'],
  'typescript': ['ts'],
  'python': ['py'],
  'csharp': ['c#', 'cs', '.net'],

  // Frameworks
  'react': ['reactjs', 'react.js'],
  'vue': ['vuejs', 'vue.js'],
  'angular': ['angularjs', 'angular.js'],
  'nextjs': ['next.js', 'next'],
  'nodejs': ['node.js', 'node'],

  // Databases
  'postgresql': ['postgres', 'psql'],
  'mongodb': ['mongo'],
  'mysql': ['sql'],

  // Tools
  'docker': ['containerization', 'containers'],
  'kubernetes': ['k8s'],
  'git': ['version control', 'vcs'],

  // French specific
  'développement': ['developpement', 'dev'],
  'gestion': ['management'],
  'analyse': ['analytics']
};

/**
 * Remove accents from string
 */
function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalize a single skill
 */
export function normalizeSkill(skill: string): string {
  // Lowercase
  let normalized = skill.toLowerCase().trim();

  // Remove accents
  normalized = removeAccents(normalized);

  // Remove special characters except dash and dot
  normalized = normalized.replace(/[^a-z0-9\-\.]/g, '');

  // Remove trailing/leading dots and dashes
  normalized = normalized.replace(/^[\-\.]+|[\-\.]+$/g, '');

  return normalized;
}

/**
 * Get all normalized forms of a skill (including aliases)
 */
export function getSkillVariants(skill: string): string[] {
  const normalized = normalizeSkill(skill);
  const variants = [normalized];

  // Check if skill matches any alias map
  for (const [canonical, aliases] of Object.entries(SKILLS_ALIASES)) {
    // If skill matches canonical or any alias, add all variants
    if (normalized === canonical || aliases.some(alias => normalizeSkill(alias) === normalized)) {
      variants.push(canonical);
      variants.push(...aliases.map(normalizeSkill));
      break;
    }
  }

  return [...new Set(variants)]; // Deduplicate
}

/**
 * Check if two skills match (with normalization and aliases)
 */
export function skillsMatch(skill1: string, skill2: string): boolean {
  const variants1 = getSkillVariants(skill1);
  const variants2 = getSkillVariants(skill2);

  // Check if any variant matches
  return variants1.some(v1 => variants2.includes(v1));
}

/**
 * Calculate skills match percentage with normalization
 */
export function calculateSkillsMatch(
  candidateSkills: string[],
  requiredSkills: string[]
): { percentage: number; matched: string[]; missing: string[] } {
  const matched: string[] = [];
  const missing: string[] = [];

  for (const required of requiredSkills) {
    const found = candidateSkills.some(candidate => skillsMatch(candidate, required));

    if (found) {
      matched.push(required);
    } else {
      missing.push(required);
    }
  }

  const percentage = requiredSkills.length > 0
    ? Math.round((matched.length / requiredSkills.length) * 100)
    : 100;

  return { percentage, matched, missing };
}

/**
 * Add custom skill alias
 */
export function addSkillAlias(canonical: string, aliases: string[]) {
  const normalizedCanonical = normalizeSkill(canonical);
  if (!SKILLS_ALIASES[normalizedCanonical]) {
    SKILLS_ALIASES[normalizedCanonical] = [];
  }
  SKILLS_ALIASES[normalizedCanonical].push(...aliases.map(normalizeSkill));
}
