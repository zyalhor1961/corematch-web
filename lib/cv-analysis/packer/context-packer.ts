/**
 * Context Packer : Compression intelligente des tokens
 *
 * Objectif : Réduire les tokens envoyés aux LLMs en ne gardant que
 * les sections pertinentes du CV, tout en préservant les informations critiques.
 *
 * Stratégie :
 * - Top-K sections les plus pertinentes
 * - Citations exactes pour les preuves
 * - Fallback au CV complet si trop petit
 */

import type { CV_JSON, JobSpec, PackedContext, PackedSection } from '../types';
import { jaccardSimilarity, extractKeywords } from '../utils/normalize';

/**
 * Configuration du packer
 */
const PACKER_CONFIG = {
  // Seuil de taille pour décider de compresser ou non
  max_full_cv_size_bytes: 8000, // Si CV < 8KB, envoyer en entier

  // Top-K sections à garder
  top_k_experiences: 5, // Garder les 5 expériences les plus pertinentes
  top_k_formations: 3, // Garder les 3 formations les plus pertinentes
  top_k_skills: 15, // Garder les 15 compétences les plus pertinentes

  // Seuil de pertinence minimum
  min_relevance_score: 0.1, // < 10% de pertinence = exclu
} as const;

/**
 * Compacter le contexte pour réduire les tokens
 */
export async function packContext(
  cv: CV_JSON,
  jobSpec: JobSpec
): Promise<PackedContext> {
  const startTime = Date.now();

  // Calculer la taille du CV complet
  const fullCvJson = JSON.stringify(cv);
  const originalSizeBytes = Buffer.byteLength(fullCvJson, 'utf-8');

  // Si le CV est déjà petit, pas besoin de compresser
  if (originalSizeBytes < PACKER_CONFIG.max_full_cv_size_bytes) {
    return {
      top_sections: [],
      citations: [],
      original_size_bytes: originalSizeBytes,
      compressed_size_bytes: originalSizeBytes,
      compression_ratio: 1.0,
      fallback_to_full: true,
    };
  }

  // =========================================================================
  // 1. Scorer les expériences par pertinence
  // =========================================================================

  const jobKeywords = [
    ...jobSpec.relevance_rules.direct,
    ...jobSpec.relevance_rules.adjacent,
    ...jobSpec.skills_required,
  ].flatMap((term) => extractKeywords(term, 3));

  const scoredExperiences = cv.experiences.map((exp) => {
    const expText = [
      exp.titre,
      exp.employeur || '',
      ...(exp.missions || []),
    ].join(' ');

    const expKeywords = extractKeywords(expText, 3);
    const relevanceScore = jaccardSimilarity(expKeywords, jobKeywords);

    return {
      section: 'experience' as const,
      index: exp.index,
      relevance_score: relevanceScore,
      content: JSON.stringify(exp),
    };
  });

  // Trier par pertinence et garder Top-K
  const topExperiences = scoredExperiences
    .filter((exp) => exp.relevance_score >= PACKER_CONFIG.min_relevance_score)
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, PACKER_CONFIG.top_k_experiences);

  // =========================================================================
  // 2. Scorer les formations par pertinence
  // =========================================================================

  const scoredFormations = cv.formations.map((formation) => {
    const formationText = [
      formation.intitule,
      formation.etablissement || '',
      formation.niveau || '',
    ].join(' ');

    const formationKeywords = extractKeywords(formationText, 3);
    const relevanceScore = jaccardSimilarity(formationKeywords, jobKeywords);

    return {
      section: 'formation' as const,
      index: formation.index,
      relevance_score: relevanceScore,
      content: JSON.stringify(formation),
    };
  });

  const topFormations = scoredFormations
    .filter((f) => f.relevance_score >= PACKER_CONFIG.min_relevance_score)
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, PACKER_CONFIG.top_k_formations);

  // =========================================================================
  // 3. Scorer les compétences par pertinence
  // =========================================================================

  const requiredSkillsNormalized = jobSpec.skills_required.map((s) => s.toLowerCase());
  const niceToHaveNormalized = jobSpec.nice_to_have.map((s) => s.toLowerCase());

  const scoredSkills = cv.competences.map((skill) => {
    const skillNormalized = skill.toLowerCase();

    // Pertinence = 1.0 si dans required, 0.5 si dans nice-to-have, 0.1 sinon
    let relevanceScore = 0.1;
    if (requiredSkillsNormalized.some((req) =>
      skillNormalized.includes(req) || req.includes(skillNormalized)
    )) {
      relevanceScore = 1.0;
    } else if (niceToHaveNormalized.some((nice) =>
      skillNormalized.includes(nice) || nice.includes(skillNormalized)
    )) {
      relevanceScore = 0.5;
    }

    return {
      section: 'skill' as const,
      index: undefined,
      relevance_score: relevanceScore,
      content: skill,
    };
  });

  const topSkills = scoredSkills
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, PACKER_CONFIG.top_k_skills);

  // =========================================================================
  // 4. Garder toutes les certifications (souvent courtes et importantes)
  // =========================================================================

  const certifications = (cv.certifications || []).map((cert, idx) => ({
    section: 'certification' as const,
    index: idx,
    relevance_score: 0.8, // Certifications = toujours pertinentes
    content: JSON.stringify(cert),
  }));

  // =========================================================================
  // 5. Construire les top_sections
  // =========================================================================

  const topSections: PackedSection[] = [
    ...topExperiences,
    ...topFormations,
    ...topSkills,
    ...certifications,
  ].sort((a, b) => b.relevance_score - a.relevance_score);

  // =========================================================================
  // 6. Extraire des citations clés (missions les plus pertinentes)
  // =========================================================================

  const citations: string[] = [];

  for (const exp of topExperiences.slice(0, 3)) {
    // Top 3 expériences
    const expData = cv.experiences.find((e) => e.index === exp.index);
    if (expData && expData.missions && expData.missions.length > 0) {
      // Prendre la première mission (souvent la plus importante)
      citations.push(`"${expData.missions[0]}" (${expData.titre}, ${expData.employeur || 'N/A'})`);
    }
  }

  // =========================================================================
  // 7. Calculer la taille compressée
  // =========================================================================

  const compressedCv = {
    identite: cv.identite, // Toujours garder identité
    top_sections: topSections,
    citations,
  };

  const compressedJson = JSON.stringify(compressedCv);
  const compressedSizeBytes = Buffer.byteLength(compressedJson, 'utf-8');
  const compressionRatio = compressedSizeBytes / originalSizeBytes;

  // =========================================================================
  // Résultat
  // =========================================================================

  return {
    top_sections: topSections,
    citations,
    original_size_bytes: originalSizeBytes,
    compressed_size_bytes: compressedSizeBytes,
    compression_ratio: compressionRatio,
    fallback_to_full: false,
  };
}

/**
 * Reconstruire un CV compacté pour envoi au LLM
 */
export function buildCompactedCV(
  cv: CV_JSON,
  packedContext: PackedContext
): Partial<CV_JSON> {
  // Si fallback, retourner le CV complet
  if (packedContext.fallback_to_full) {
    return cv;
  }

  // Reconstruire un CV avec seulement les sections pertinentes
  const compactedCV: Partial<CV_JSON> = {
    identite: cv.identite,
    experiences: [],
    formations: [],
    competences: [],
    certifications: [],
  };

  // Extraire les sections du packing
  for (const section of packedContext.top_sections) {
    switch (section.type) {
      case 'experience':
        const exp = cv.experiences.find((e) => e.index === section.index);
        if (exp) compactedCV.experiences!.push(exp);
        break;

      case 'formation':
        const formation = cv.formations.find((f) => f.index === section.index);
        if (formation) compactedCV.formations!.push(formation);
        break;

      case 'skill':
        compactedCV.competences!.push(section.content);
        break;

      case 'certification':
        const cert = cv.certifications?.[section.index!];
        if (cert) compactedCV.certifications!.push(cert);
        break;
    }
  }

  return compactedCV;
}

/**
 * Helper : Estimer le gain de tokens
 */
export function estimateTokenSavings(packedContext: PackedContext): {
  savedBytes: number;
  savedTokensEstimate: number;
  savingsPercent: number;
} {
  const savedBytes = packedContext.original_size_bytes - packedContext.compressed_size_bytes;

  // Estimation grossière : 1 token ≈ 4 caractères (pour le français)
  const savedTokensEstimate = Math.round(savedBytes / 4);

  const savingsPercent = (1 - packedContext.compression_ratio) * 100;

  return {
    savedBytes,
    savedTokensEstimate,
    savingsPercent,
  };
}
