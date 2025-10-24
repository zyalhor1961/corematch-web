/**
 * Utilitaires de normalisation de texte
 * Minuscules, accents, lemmatisation simple, nettoyage
 */

/**
 * Normaliser un texte: minuscules + suppression accents
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD') // Décompose les caractères accentués
    .replace(/[\u0300-\u036f]/g, '') // Supprime les diacritiques
    .trim();
}

/**
 * Normaliser et tokenizer (split par espaces/ponctuation)
 */
export function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized
    .split(/[\s,;.!?()[\]{}'"/\\]+/) // Split par espaces et ponctuation
    .filter((token) => token.length > 0);
}

/**
 * Supprimer les stop words français courants
 */
const FRENCH_STOP_WORDS = new Set([
  'le',
  'la',
  'les',
  'un',
  'une',
  'des',
  'de',
  'du',
  'et',
  'ou',
  'mais',
  'donc',
  'or',
  'ni',
  'car',
  'dans',
  'sur',
  'sous',
  'avec',
  'sans',
  'pour',
  'par',
  'à',
  'au',
  'aux',
  'ce',
  'cet',
  'cette',
  'ces',
  'mon',
  'ton',
  'son',
  'ma',
  'ta',
  'sa',
  'mes',
  'tes',
  'ses',
  'notre',
  'votre',
  'leur',
  'nos',
  'vos',
  'leurs',
  'qui',
  'que',
  'quoi',
  'dont',
  'où',
  'il',
  'elle',
  'nous',
  'vous',
  'ils',
  'elles',
  'je',
  'tu',
  'on',
  'y',
  'en',
]);

export function removeStopWords(tokens: string[]): string[] {
  return tokens.filter((token) => !FRENCH_STOP_WORDS.has(token));
}

/**
 * Lemmatisation simple (approximation)
 * Supprime les terminaisons courantes (-s, -ment, -tion, etc.)
 */
export function simpleLemmatize(word: string): string {
  const normalized = normalizeText(word);

  // Pluriels
  if (normalized.endsWith('s') && normalized.length > 3) {
    return normalized.slice(0, -1);
  }

  // -ment → base
  if (normalized.endsWith('ment') && normalized.length > 6) {
    return normalized.slice(0, -4);
  }

  // -tion → base
  if (normalized.endsWith('tion') && normalized.length > 6) {
    return normalized.slice(0, -4);
  }

  // -eur → base
  if (normalized.endsWith('eur') && normalized.length > 5) {
    return normalized.slice(0, -3);
  }

  return normalized;
}

/**
 * Normaliser une compétence (pour matching)
 * Exemples:
 * - "React.js" → "reactjs"
 * - "Node.JS" → "nodejs"
 * - "C++" → "cpp"
 */
export function normalizeSkill(skill: string): string {
  let normalized = normalizeText(skill);

  // Cas spéciaux
  const specialCases: Record<string, string> = {
    'c++': 'cpp',
    'c#': 'csharp',
    '.net': 'dotnet',
    'node.js': 'nodejs',
    'react.js': 'reactjs',
    'vue.js': 'vuejs',
    'next.js': 'nextjs',
  };

  if (specialCases[normalized]) {
    return specialCases[normalized];
  }

  // Supprimer les points, tirets, underscores
  normalized = normalized.replace(/[.\-_]/g, '');

  return normalized;
}

/**
 * Vérifier si deux compétences correspondent (avec variantes)
 */
export function skillsMatch(skill1: string, skill2: string): boolean {
  const norm1 = normalizeSkill(skill1);
  const norm2 = normalizeSkill(skill2);

  // Correspondance exacte
  if (norm1 === norm2) return true;

  // Correspondance partielle (contient)
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return true;
  }

  // Variantes connues
  const variants: Record<string, string[]> = {
    javascript: ['js', 'ecmascript', 'es6', 'es2015'],
    typescript: ['ts'],
    python: ['py'],
    java: ['jdk', 'jre'],
    reactjs: ['react'],
    nodejs: ['node'],
    postgresql: ['postgres', 'psql'],
    mongodb: ['mongo'],
  };

  for (const [main, alts] of Object.entries(variants)) {
    if ((norm1 === main && alts.includes(norm2)) || (norm2 === main && alts.includes(norm1))) {
      return true;
    }
  }

  return false;
}

/**
 * Nettoyer un texte (supprimer caractères spéciaux, espaces multiples)
 */
export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Espaces multiples → simple
    .replace(/[^\w\sÀ-ÿ.,;:!?()\-]/g, '') // Garde lettres, chiffres, ponctuation de base
    .trim();
}

/**
 * Extraire les mots-clés d'un texte (tokens significatifs)
 */
export function extractKeywords(text: string, minLength: number = 3): string[] {
  const tokens = tokenize(text);
  const withoutStopWords = removeStopWords(tokens);

  return withoutStopWords
    .filter((token) => token.length >= minLength)
    .map((token) => simpleLemmatize(token));
}

/**
 * Calculer similarité Jaccard entre deux ensembles de mots
 */
export function jaccardSimilarity(set1: string[], set2: string[]): number {
  const s1 = new Set(set1.map(normalizeText));
  const s2 = new Set(set2.map(normalizeText));

  const intersection = new Set([...s1].filter((x) => s2.has(x)));
  const union = new Set([...s1, ...s2]);

  if (union.size === 0) return 0;

  return intersection.size / union.size;
}

/**
 * Trouver les compétences présentes dans le CV (depuis une liste de required)
 */
export function findMatchingSkills(
  cvSkills: string[],
  requiredSkills: string[]
): { matched: string[]; missing: string[] } {
  const matched: string[] = [];
  const missing: string[] = [];

  for (const required of requiredSkills) {
    const found = cvSkills.some((cvSkill) => skillsMatch(cvSkill, required));

    if (found) {
      matched.push(required);
    } else {
      missing.push(required);
    }
  }

  return { matched, missing };
}

/**
 * Compter les occurrences d'un mot dans un texte (insensible à la casse/accents)
 */
export function countOccurrences(text: string, word: string): number {
  const normalizedText = normalizeText(text);
  const normalizedWord = normalizeText(word);
  const regex = new RegExp(`\\b${normalizedWord}\\b`, 'g');
  const matches = normalizedText.match(regex);
  return matches ? matches.length : 0;
}
