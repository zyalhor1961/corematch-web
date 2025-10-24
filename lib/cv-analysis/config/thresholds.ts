/**
 * Configuration des seuils d'évaluation
 * Par défaut et par domaine métier
 */

import type { Weights, Thresholds } from '../types';

/**
 * Poids par défaut pour le calcul du score
 */
export const DEFAULT_WEIGHTS: Weights = {
  w_exp: 0.5, // 50% expérience
  w_skills: 0.3, // 30% compétences
  w_nice: 0.2, // 20% nice-to-have
  p_adjacent: 0.5, // Expériences adjacentes comptent pour 50%
};

/**
 * Seuils par défaut
 */
export const DEFAULT_THRESHOLDS: Thresholds = {
  years_full_score: 3, // 3 ans = score expérience maximal
  shortlist_min: 75, // ≥75 = SHORTLIST
  consider_min: 60, // ≥60 = CONSIDER, <60 = REJECT
};

/**
 * Configuration par domaine métier
 * Permet d'adapter les poids et seuils selon le secteur
 */
export interface DomainConfig {
  domain: string;
  weights: Weights;
  thresholds: Thresholds;
  description: string;
}

/**
 * Configurations métier prédéfinies
 */
export const DOMAIN_CONFIGS: Record<string, DomainConfig> = {
  // Tech / IT - Valorise les compétences techniques
  tech: {
    domain: 'tech',
    weights: {
      w_exp: 0.4,
      w_skills: 0.45, // Plus de poids sur skills
      w_nice: 0.15,
      p_adjacent: 0.6, // Transfert de compétences tech facile
    },
    thresholds: {
      years_full_score: 5, // Tech = séniorité plus longue
      shortlist_min: 75,
      consider_min: 60,
    },
    description: 'Développement, IT, Data Science',
  },

  // Enseignement / Formation - Valorise l'expérience directe
  teaching: {
    domain: 'teaching',
    weights: {
      w_exp: 0.6, // Expérience primordiale
      w_skills: 0.25,
      w_nice: 0.15,
      p_adjacent: 0.4, // Moins de transfert de compétences
    },
    thresholds: {
      years_full_score: 3,
      shortlist_min: 75,
      consider_min: 60,
    },
    description: 'Enseignement, Formation, FLE',
  },

  // BTP / Artisanat - Compétences terrain critiques
  construction: {
    domain: 'construction',
    weights: {
      w_exp: 0.55,
      w_skills: 0.35, // Compétences techniques importantes
      w_nice: 0.1,
      p_adjacent: 0.3, // Peu de transfert (peintre ≠ électricien)
    },
    thresholds: {
      years_full_score: 3,
      shortlist_min: 70, // Seuil légèrement plus bas
      consider_min: 55,
    },
    description: 'BTP, Artisanat, Métiers manuels',
  },

  // Management / Business - Expérience et soft skills
  management: {
    domain: 'management',
    weights: {
      w_exp: 0.5,
      w_skills: 0.3,
      w_nice: 0.2, // Nice-to-have = soft skills
      p_adjacent: 0.7, // Transfert de compétences managériales
    },
    thresholds: {
      years_full_score: 5, // Séniorité importante
      shortlist_min: 75,
      consider_min: 60,
    },
    description: 'Management, Direction, Chef de projet',
  },

  // Santé / Médical - Règles strictes
  healthcare: {
    domain: 'healthcare',
    weights: {
      w_exp: 0.5,
      w_skills: 0.4, // Compétences critiques
      w_nice: 0.1,
      p_adjacent: 0.2, // Peu de transfert (réglementation)
    },
    thresholds: {
      years_full_score: 3,
      shortlist_min: 80, // Seuil plus élevé (sécurité)
      consider_min: 65,
    },
    description: 'Santé, Médical, Paramédical',
  },

  // Générique / par défaut
  default: {
    domain: 'default',
    weights: DEFAULT_WEIGHTS,
    thresholds: DEFAULT_THRESHOLDS,
    description: 'Configuration générique',
  },
};

/**
 * Helper: obtenir la config d'un domaine
 */
export function getDomainConfig(domain?: string): DomainConfig {
  if (!domain || !DOMAIN_CONFIGS[domain]) {
    return DOMAIN_CONFIGS.default;
  }
  return DOMAIN_CONFIGS[domain];
}

/**
 * Helper: détecter le domaine depuis le titre du poste
 * (Heuristique simple, peut être améliorée)
 */
export function detectDomain(jobTitle: string): string {
  const title = jobTitle.toLowerCase();

  if (
    title.includes('développeur') ||
    title.includes('dev ') ||
    title.includes('ingénieur') ||
    title.includes('data') ||
    title.includes('tech')
  ) {
    return 'tech';
  }

  if (
    title.includes('professeur') ||
    title.includes('enseignant') ||
    title.includes('formateur') ||
    title.includes('fle')
  ) {
    return 'teaching';
  }

  if (
    title.includes('peintre') ||
    title.includes('électricien') ||
    title.includes('plombier') ||
    title.includes('maçon') ||
    title.includes('btp')
  ) {
    return 'construction';
  }

  if (
    title.includes('manager') ||
    title.includes('directeur') ||
    title.includes('chef de projet') ||
    title.includes('responsable')
  ) {
    return 'management';
  }

  if (
    title.includes('infirmier') ||
    title.includes('médecin') ||
    title.includes('aide-soignant') ||
    title.includes('santé')
  ) {
    return 'healthcare';
  }

  return 'default';
}

/**
 * Seuils pour le consensus multi-provider
 */
export const CONSENSUS_THRESHOLDS = {
  strong_agreement_rate: 1.0, // 100% d'accord sur recommendation
  moderate_agreement_rate: 0.66, // 66%+ d'accord
  max_score_delta_strong: 10, // Delta max pour consensus fort (10 pts)
  max_score_delta_moderate: 20, // Delta max pour consensus modéré (20 pts)
};

/**
 * Helper: merger des poids/thresholds custom avec les valeurs par défaut
 */
export function mergeConfig(
  domain?: string,
  customWeights?: Partial<Weights>,
  customThresholds?: Partial<Thresholds>
): { weights: Weights; thresholds: Thresholds } {
  const domainConfig = getDomainConfig(domain);

  return {
    weights: { ...domainConfig.weights, ...customWeights },
    thresholds: { ...domainConfig.thresholds, ...customThresholds },
  };
}
