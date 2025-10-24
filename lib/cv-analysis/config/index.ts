/**
 * Configuration centralisée pour le système d'analyse CV
 *
 * Exports:
 * - modes.ts: Configuration Éco/Équilibré/Premium
 * - providers.ts: Configuration OpenAI/Gemini/Claude
 * - thresholds.ts: Seuils et poids par domaine métier
 */

// Modes d'analyse
export {
  ANALYSIS_MODES,
  UNCERTAINTY_THRESHOLDS,
  DEFAULT_MODE,
  getModeConfig,
  estimateCost,
  isValidMode,
} from './modes';

// Providers
export {
  PROVIDER_CONFIGS,
  EXTRACTION_MODEL,
  ARBITER_MODEL,
  PROVIDERS_BY_MODE,
  PROVIDER_COSTS_PER_1M_TOKENS,
  getProviderConfig,
  getProvidersForMode,
  normalizeWeights,
  calculateProviderCost,
} from './providers';

// Thresholds et domaines
export {
  DEFAULT_WEIGHTS,
  DEFAULT_THRESHOLDS,
  CONSENSUS_THRESHOLDS,
  DOMAIN_CONFIGS,
  getDomainConfig,
  detectDomain,
  mergeConfig,
} from './thresholds';

export type { DomainConfig } from './thresholds';
