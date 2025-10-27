/**
 * Retry Logic avec Exponential Backoff
 *
 * Permet de réessayer automatiquement les opérations qui échouent
 * avec des erreurs transitoires (network, rate limiting, etc.)
 */

import type { RetryConfig } from './types';
import { DEFAULT_RETRY_CONFIG } from './types';

/**
 * Délai avant le prochain retry
 */
function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig
): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Vérifie si une erreur est retryable
 */
function isRetryableError(error: any, config: RetryConfig): boolean {
  // Si une fonction custom est fournie, l'utiliser
  if (config.isRetryable) {
    return config.isRetryable(error);
  }

  // Vérifier le code d'erreur
  const errorCode = error.code || error.status || error.statusCode || '';
  const errorMessage = error.message || '';

  // Vérifier si l'erreur correspond aux codes retryables
  return config.retryableErrors.some((retryableCode) => {
    return (
      errorCode.toString().includes(retryableCode) ||
      errorMessage.includes(retryableCode)
    );
  });
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exécute une fonction avec retry automatique en cas d'erreur transitoire
 *
 * @param fn Fonction à exécuter
 * @param config Configuration du retry
 * @returns Résultat de la fonction
 * @throws Erreur si tous les retries échouent
 *
 * @example
 * const result = await withRetry(
 *   () => callAPI(),
 *   { maxRetries: 2, initialDelayMs: 1000 }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const fullConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  let lastError: any;
  let attempt = 0;

  while (attempt <= fullConfig.maxRetries) {
    try {
      // Tentative d'exécution
      const result = await fn();

      // Succès !
      if (attempt > 0) {
        console.log(`[Retry] ✅ Success after ${attempt} retries`);
      }

      return result;
    } catch (error) {
      lastError = error;

      // Vérifier si on peut retry
      const canRetry = attempt < fullConfig.maxRetries && isRetryableError(error, fullConfig);

      if (!canRetry) {
        // Plus de retries disponibles ou erreur non-retryable
        if (attempt > 0) {
          console.error(`[Retry] ❌ Failed after ${attempt} retries:`, error);
        }
        throw error;
      }

      // Calculer le délai avant le prochain retry
      const delayMs = calculateBackoffDelay(attempt, fullConfig);

      console.warn(
        `[Retry] ⚠️  Attempt ${attempt + 1} failed (retryable error), ` +
        `retrying in ${delayMs}ms...`,
        error
      );

      // Attendre avant de retry
      await sleep(delayMs);

      attempt++;
    }
  }

  // Normalement on ne devrait jamais arriver ici
  throw lastError;
}

/**
 * Wrapper pour retry avec gestion des erreurs spécifiques
 *
 * @example
 * const result = await retryOnRateLimit(
 *   () => callAPI(),
 *   3 // max retries
 * );
 */
export async function retryOnRateLimit<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2
): Promise<T> {
  return withRetry(fn, {
    maxRetries,
    initialDelayMs: 2000, // Plus long pour rate limiting
    maxDelayMs: 30000,
    retryableErrors: ['429', 'RATE_LIMIT'],
  });
}

/**
 * Wrapper pour retry sur erreurs réseau
 *
 * @example
 * const result = await retryOnNetworkError(
 *   () => callAPI(),
 *   2 // max retries
 * );
 */
export async function retryOnNetworkError<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2
): Promise<T> {
  return withRetry(fn, {
    maxRetries,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    retryableErrors: [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ENETUNREACH',
      '502',
      '503',
      '504',
    ],
  });
}
