/**
 * Cache Key Generation with Job Isolation
 *
 * CRITICAL: Chaque clé de cache DOIT inclure le jobSpecHash pour éviter
 * les "fuites de poste" (CV analysé pour Job A réutilisé pour Job B)
 *
 * Format: corematch:cv:{cvHash}:project:{projectId}:job:{jobSpecHash}:mode:{mode}
 */

import crypto from 'crypto';
import type { CV_JSON, JobSpec, AnalysisMode } from '@/lib/cv-analysis/types';

/**
 * Options pour génération de clé de cache
 */
export interface CacheKeyOptions {
  cvJson?: CV_JSON; // Optionnel si cvTextHash est fourni
  cvTextHash?: string; // Hash pré-calculé du texte brut (préféré pour déterminisme)
  projectId: string;
  jobSpec: JobSpec;
  mode: AnalysisMode;
  analysisDate?: string; // Optionnel, pour invalidation si jobSpec évolue
}

/**
 * Hash stable d'un objet JSON
 * IMPORTANT: Trie les clés pour garantir hash stable
 */
export function hashObject(obj: any): string {
  // Trier les clés récursivement pour hash stable
  const sortedObj = sortObjectKeys(obj);
  const jsonString = JSON.stringify(sortedObj);

  return crypto
    .createHash('sha256')
    .update(jsonString)
    .digest('hex')
    .substring(0, 16); // 16 chars = 64 bits, suffisant pour éviter collisions
}

/**
 * Trier les clés d'un objet récursivement
 */
function sortObjectKeys(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);

  return Object.keys(obj)
    .sort()
    .reduce((sorted: any, key) => {
      sorted[key] = sortObjectKeys(obj[key]);
      return sorted;
    }, {});
}

/**
 * Hash du texte brut du CV (DÉTERMINISTE)
 *
 * IMPORTANT: Cette méthode est préférée car elle garantit un hash stable
 * même si l'extraction LLM produit des variations mineures dans le JSON.
 *
 * @param text Texte brut du CV (avant extraction)
 * @returns Hash SHA256 du texte normalisé (16 caractères)
 */
export function hashCVText(text: string): string {
  // Normaliser le texte pour hash stable
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' '); // Normaliser les espaces multiples

  return crypto
    .createHash('sha256')
    .update(normalized)
    .digest('hex')
    .substring(0, 16);
}

/**
 * Hash du CV JSON (identité + expériences + compétences)
 * Exclut les métadonnées non pertinentes pour l'analyse
 *
 * ⚠️ NON-DÉTERMINISTE: L'extraction LLM peut produire des variations.
 * Préférer hashCVText() pour un cache stable.
 */
export function hashCV(cvJson: CV_JSON): string {
  const relevantData = {
    identite: cvJson.identite,
    experiences: cvJson.experiences,
    formations: cvJson.formations,
    competences: cvJson.competences,
    langues: cvJson.langues,
    certifications: cvJson.certifications,
    projets: cvJson.projets,
  };

  return hashObject(relevantData);
}

/**
 * Hash du JobSpec (critères d'évaluation)
 * Inclut tous les champs qui influencent l'évaluation
 */
export function hashJobSpec(jobSpec: JobSpec): string {
  const relevantData = {
    title: jobSpec.title,
    must_have: jobSpec.must_have,
    skills_required: jobSpec.skills_required,
    nice_to_have: jobSpec.nice_to_have,
    relevance_rules: jobSpec.relevance_rules,
    weights: jobSpec.weights,
    thresholds: jobSpec.thresholds,
    // N'inclut PAS analysis_date (non critique pour cache)
  };

  return hashObject(relevantData);
}

/**
 * Générer une clé de cache robuste avec isolation par job
 *
 * @returns Clé de cache unique: corematch:cv:{cvHash}:project:{projectId}:job:{jobHash}:mode:{mode}
 *
 * @example
 * // CV Teacher analysé pour Job FLE
 * generateCacheKey({
 *   cvJson: cvTeacher,
 *   projectId: 'proj-fle-2025',
 *   jobSpec: jobFLE,
 *   mode: 'balanced'
 * })
 * // => "corematch:cv:a1b2c3d4:project:proj-fle-2025:job:e5f6g7h8:mode:balanced"
 *
 * // Même CV pour Job Painter => CLÉ DIFFÉRENTE
 * generateCacheKey({
 *   cvJson: cvTeacher, // Même CV
 *   projectId: 'proj-painter-2025',
 *   jobSpec: jobPainter, // Job différent
 *   mode: 'balanced'
 * })
 * // => "corematch:cv:a1b2c3d4:project:proj-painter-2025:job:x9y8z7w6:mode:balanced"
 */
export function generateCacheKey(options: CacheKeyOptions): string {
  // Utiliser cvTextHash si fourni (préféré), sinon hasher le cvJson
  const cvHash = options.cvTextHash
    ? options.cvTextHash
    : options.cvJson
      ? hashCV(options.cvJson)
      : (() => { throw new Error('Either cvTextHash or cvJson must be provided'); })();

  const jobHash = hashJobSpec(options.jobSpec);

  const parts = [
    'corematch',
    `cv:${cvHash}`,
    `project:${options.projectId}`,
    `job:${jobHash}`,
    `mode:${options.mode}`,
  ];

  // Ajouter date si fournie (pour invalidation si jobSpec évolue dans le temps)
  if (options.analysisDate) {
    parts.push(`date:${options.analysisDate}`);
  }

  return parts.join(':');
}

/**
 * Parser une clé de cache pour extraire ses composants
 * Utile pour debugging et monitoring
 */
export function parseCacheKey(cacheKey: string): {
  cvHash: string;
  projectId: string;
  jobHash: string;
  mode: AnalysisMode;
  analysisDate?: string;
} | null {
  const parts = cacheKey.split(':');

  // Format: corematch:cv:{cvHash}:project:{projectId}:job:{jobHash}:mode:{mode}[:date:{date}]
  // After split: [0]=corematch, [1]=cv, [2]={cvHash}, [3]=project, [4]={projectId}, ...

  if (parts[0] !== 'corematch') return null;
  if (parts[1] !== 'cv') return null;
  if (parts[3] !== 'project') return null;
  if (parts[5] !== 'job') return null;
  if (parts[7] !== 'mode') return null;

  const cvHash = parts[2];
  const projectId = parts[4];
  const jobHash = parts[6];
  const mode = parts[8] as AnalysisMode;
  const analysisDate = parts[9] === 'date' ? parts[10] : undefined;

  if (!cvHash || !projectId || !jobHash || !mode) return null;

  return {
    cvHash,
    projectId,
    jobHash,
    mode,
    analysisDate,
  };
}

/**
 * Vérifier si deux JobSpecs sont identiques (même hash)
 * Utile pour tests et validation
 */
export function areJobSpecsEqual(jobSpec1: JobSpec, jobSpec2: JobSpec): boolean {
  return hashJobSpec(jobSpec1) === hashJobSpec(jobSpec2);
}

/**
 * Vérifier si deux CVs sont identiques (même hash)
 * Utile pour tests et validation
 */
export function areCVsEqual(cv1: CV_JSON, cv2: CV_JSON): boolean {
  return hashCV(cv1) === hashCV(cv2);
}
