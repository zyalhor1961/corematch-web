/**
 * Configuration des providers IA
 * OpenAI / Gemini / Claude
 */

import type { ProviderName, ProviderConfig } from '../types';

/**
 * Configuration des providers disponibles
 */
export const PROVIDER_CONFIGS: Record<ProviderName, ProviderConfig> = {
  openai: {
    name: 'openai',
    model: 'gpt-4o',
    temperature: 0,
    max_tokens: 4096,
    weight: 0.55, // Pondération dans l'agrégation (55%)
  },

  gemini: {
    name: 'gemini',
    model: 'gemini-2.0-flash-exp', // Gemini 2.0 Flash (rapide et économique)
    temperature: 0,
    max_tokens: 4096,
    weight: 0.30, // 30%
  },

  claude: {
    name: 'claude',
    model: 'claude-sonnet-4-5-20250929', // Claude Sonnet 4.5 (septembre 2025)
    temperature: 0,
    max_tokens: 4096,
    weight: 0.15, // 15%
  },
};

/**
 * Modèle utilisé pour l'extraction (Pass 1)
 * Rapide et économique
 */
export const EXTRACTION_MODEL = {
  provider: 'openai' as const,
  model: 'gpt-4o-mini',
  temperature: 0,
  max_tokens: 4096,
};

/**
 * Modèle utilisé pour l'arbitre (juge)
 * Le plus "intelligent" pour résoudre les désaccords
 */
export const ARBITER_MODEL = {
  provider: 'openai' as const,
  model: 'gpt-4o',
  temperature: 0.1, // Légère créativité pour l'arbitrage
  max_tokens: 2048,
};

/**
 * Providers utilisés selon le mode
 */
export const PROVIDERS_BY_MODE = {
  eco: ['openai'] as ProviderName[],
  balanced: ['openai', 'gemini'] as ProviderName[], // Gemini ajouté si triggers
  premium: ['openai', 'gemini', 'claude'] as ProviderName[],
} as const;

/**
 * Helper: obtenir la config d'un provider
 */
export function getProviderConfig(provider: ProviderName): ProviderConfig {
  return PROVIDER_CONFIGS[provider];
}

/**
 * Helper: obtenir les providers pour un mode
 */
export function getProvidersForMode(mode: keyof typeof PROVIDERS_BY_MODE): ProviderName[] {
  return [...PROVIDERS_BY_MODE[mode]];
}

/**
 * Helper: normaliser les poids pour qu'ils somment à 1.0
 */
export function normalizeWeights(providers: ProviderName[]): Record<ProviderName, number> {
  const weights: Partial<Record<ProviderName, number>> = {};
  let sum = 0;

  // Calcul de la somme des poids
  for (const provider of providers) {
    const config = getProviderConfig(provider);
    weights[provider] = config.weight;
    sum += config.weight;
  }

  // Normalisation
  const normalized: Partial<Record<ProviderName, number>> = {};
  for (const provider of providers) {
    normalized[provider] = (weights[provider] || 0) / sum;
  }

  return normalized as Record<ProviderName, number>;
}

/**
 * Coûts estimés par provider (USD pour 1M tokens)
 * Source: Tarifs publics au 2025-01
 */
export const PROVIDER_COSTS_PER_1M_TOKENS = {
  openai: {
    'gpt-4o': { input: 2.5, output: 10.0 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
  },
  gemini: {
    'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  },
  claude: {
    'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  },
} as const;

/**
 * Helper: calculer le coût d'un appel
 */
export function calculateProviderCost(
  provider: ProviderName,
  model: string,
  tokensInput: number,
  tokensOutput: number
): number {
  const costs = PROVIDER_COSTS_PER_1M_TOKENS[provider] as any;
  if (!costs || !costs[model]) {
    console.warn(`[Cost] Unknown cost for ${provider}/${model}, using default`);
    return 0.01; // Coût par défaut
  }

  const pricing = costs[model];
  const costInput = (tokensInput / 1_000_000) * pricing.input;
  const costOutput = (tokensOutput / 1_000_000) * pricing.output;

  return costInput + costOutput;
}
