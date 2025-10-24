/**
 * Skills Map : Synonymes et alias de compétences
 *
 * Permet de reconnaître les variantes d'une même compétence
 * (ex: "React.js" = "ReactJS" = "React")
 */

import { normalizeSkill } from '../utils/normalize';

/**
 * Map de synonymes prédéfinis
 */
export const SKILLS_ALIASES: Record<string, string[]> = {
  // Frontend
  react: ['reactjs', 'react.js', 'react js'],
  vue: ['vuejs', 'vue.js', 'vue js'],
  angular: ['angularjs', 'angular.js', 'angular 2+'],
  next: ['nextjs', 'next.js', 'next js'],
  nuxt: ['nuxtjs', 'nuxt.js', 'nuxt js'],

  // Backend
  node: ['nodejs', 'node.js', 'node js'],
  express: ['expressjs', 'express.js'],
  nest: ['nestjs', 'nest.js'],

  // Databases
  postgresql: ['postgres', 'psql', 'pg'],
  mongodb: ['mongo', 'mongo db'],
  mysql: ['my sql'],
  redis: ['redis db'],

  // Languages
  javascript: ['js', 'ecmascript', 'es6', 'es2015', 'es2020'],
  typescript: ['ts'],
  python: ['py'],
  cpp: ['c++', 'cplusplus'],
  csharp: ['c#', 'c sharp'],

  // DevOps
  docker: ['docker compose', 'dockerfile'],
  kubernetes: ['k8s', 'kube'],
  aws: ['amazon web services', 'amazon aws'],
  azure: ['microsoft azure', 'ms azure'],
  gcp: ['google cloud', 'google cloud platform'],

  // Tools
  git: ['github', 'gitlab', 'bitbucket'],
  jenkins: ['jenkins ci', 'jenkins cd'],
  gitlab: ['gitlab ci', 'gitlab ci/cd'],

  // Métiers spécifiques (FLE example)
  fle: ['francais langue etrangere', 'français langue étrangère', 'enseignement fle'],
  fos: ['francais objectifs specifiques', 'français sur objectifs spécifiques'],
  delf: ['delf dalf', 'diplome detudes'],
  tcf: ['test connaissance francais', 'test de connaissance du français'],

  // BTP
  placo: ['placoplatre', 'placo platre', 'plaque platre'],
  electricite: ['elec', 'installation electrique', 'électricité'],
  plomberie: ['plomb', 'sanitaire', 'chauffage'],
};

/**
 * Registre dynamique pour ajouter des aliases personnalisés
 */
const customAliases: Record<string, string[]> = {};

/**
 * Ajouter un alias personnalisé
 */
export function addSkillAlias(mainSkill: string, aliases: string[]): void {
  const normalized = normalizeSkill(mainSkill);
  customAliases[normalized] = aliases.map((a) => normalizeSkill(a));
}

/**
 * Obtenir tous les aliases d'une compétence
 */
export function getSkillAliases(skill: string): string[] {
  const normalized = normalizeSkill(skill);

  // Chercher dans les alias prédéfinis
  if (SKILLS_ALIASES[normalized]) {
    return SKILLS_ALIASES[normalized];
  }

  // Chercher dans les alias customs
  if (customAliases[normalized]) {
    return customAliases[normalized];
  }

  // Chercher si la compétence est elle-même un alias
  for (const [mainSkill, aliases] of Object.entries(SKILLS_ALIASES)) {
    if (aliases.includes(normalized)) {
      return [mainSkill, ...aliases];
    }
  }

  for (const [mainSkill, aliases] of Object.entries(customAliases)) {
    if (aliases.includes(normalized)) {
      return [mainSkill, ...aliases];
    }
  }

  // Pas d'alias trouvé
  return [normalized];
}

/**
 * Vérifier si deux compétences correspondent (avec aliases)
 */
export function skillsMatch(skill1: string, skill2: string): boolean {
  const norm1 = normalizeSkill(skill1);
  const norm2 = normalizeSkill(skill2);

  // Correspondance exacte
  if (norm1 === norm2) return true;

  // Correspondance partielle (contient)
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

  // Vérifier aliases
  const aliases1 = getSkillAliases(norm1);
  const aliases2 = getSkillAliases(norm2);

  // Si l'un des aliases de skill1 correspond à skill2 ou ses aliases
  for (const alias1 of aliases1) {
    if (alias1 === norm2 || aliases2.includes(alias1)) {
      return true;
    }
  }

  return false;
}

/**
 * Trouver les compétences du CV qui correspondent aux compétences requises
 */
export function matchSkills(
  cvSkills: string[],
  requiredSkills: string[]
): {
  matched: Array<{ cvSkill: string; requiredSkill: string }>;
  missing: string[];
  matchRate: number;
} {
  const matched: Array<{ cvSkill: string; requiredSkill: string }> = [];
  const missing: string[] = [];

  for (const requiredSkill of requiredSkills) {
    let found = false;

    for (const cvSkill of cvSkills) {
      if (skillsMatch(cvSkill, requiredSkill)) {
        matched.push({ cvSkill, requiredSkill });
        found = true;
        break;
      }
    }

    if (!found) {
      missing.push(requiredSkill);
    }
  }

  const matchRate = requiredSkills.length > 0 ? matched.length / requiredSkills.length : 0;

  return { matched, missing, matchRate };
}

/**
 * Enrichir une JobSpec avec les aliases de compétences
 */
export function enrichJobSpecWithAliases(
  jobSpec: { skills_required: string[]; nice_to_have: string[] }
): {
  skills_required_enriched: string[];
  nice_to_have_enriched: string[];
} {
  const skillsRequiredEnriched = new Set<string>();
  const niceToHaveEnriched = new Set<string>();

  // Enrichir skills_required
  for (const skill of jobSpec.skills_required) {
    skillsRequiredEnriched.add(skill);
    const aliases = getSkillAliases(skill);
    aliases.forEach((alias) => skillsRequiredEnriched.add(alias));
  }

  // Enrichir nice_to_have
  for (const skill of jobSpec.nice_to_have) {
    niceToHaveEnriched.add(skill);
    const aliases = getSkillAliases(skill);
    aliases.forEach((alias) => niceToHaveEnriched.add(alias));
  }

  return {
    skills_required_enriched: Array.from(skillsRequiredEnriched),
    nice_to_have_enriched: Array.from(niceToHaveEnriched),
  };
}
