/**
 * MCP Resilience Module
 *
 * Système de résilience pour les appels LLM:
 * - Retry avec exponential backoff
 * - Circuit breaker par provider
 * - Timeout adaptatif
 *
 * Usage:
 * ```typescript
 * import { resilientCall, getCircuitBreaker } from '@/lib/mcp/resilience';
 *
 * const cb = getCircuitBreaker('openai');
 *
 * const result = await resilientCall(
 *   () => callOpenAI(),
 *   {
 *     circuitBreaker: cb,
 *     timeoutMs: 30000,
 *     retryConfig: { maxRetries: 2 }
 *   }
 * );
 * ```
 */

// Re-export types
export type {
  RetryConfig,
  CircuitBreakerConfig,
  CircuitState,
  CircuitBreakerStats,
} from './types';

export {
  DEFAULT_RETRY_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  CircuitBreakerOpenError,
  TimeoutError,
} from './types';

// Re-export retry functions
export {
  withRetry,
  retryOnRateLimit,
  retryOnNetworkError,
} from './retry';

// Re-export circuit breaker
export {
  CircuitBreaker,
  getCircuitBreaker,
  resetAllCircuitBreakers,
} from './circuit-breaker';

// Re-export timeout functions
export {
  withTimeout,
  withAdaptiveTimeout,
  delay,
} from './timeout';

// Combined resilient call
import { withRetry } from './retry';
import { CircuitBreaker } from './circuit-breaker';
import { withTimeout } from './timeout';
import type { RetryConfig } from './types';

/**
 * Options pour un appel résilient
 */
export interface ResilientCallOptions {
  /** Circuit breaker à utiliser (optionnel) */
  circuitBreaker?: CircuitBreaker;

  /** Timeout en millisecondes (optionnel) */
  timeoutMs?: number;

  /** Configuration du retry (optionnel) */
  retryConfig?: Partial<RetryConfig>;
}

/**
 * Exécute une fonction avec protection complète:
 * - Circuit breaker (si fourni)
 * - Timeout (si fourni)
 * - Retry avec exponential backoff
 *
 * @param fn Fonction à exécuter
 * @param options Options de résilience
 * @returns Résultat de la fonction
 *
 * @example
 * const result = await resilientCall(
 *   () => callAPI(),
 *   {
 *     circuitBreaker: getCircuitBreaker('openai'),
 *     timeoutMs: 30000,
 *     retryConfig: { maxRetries: 2 }
 *   }
 * );
 */
export async function resilientCall<T>(
  fn: () => Promise<T>,
  options: ResilientCallOptions = {}
): Promise<T> {
  const { circuitBreaker, timeoutMs, retryConfig } = options;

  // Wrapper qui applique toutes les protections
  const wrappedFn = async () => {
    // 1. Appliquer timeout si fourni
    const fnWithTimeout = timeoutMs
      ? () => withTimeout(fn(), timeoutMs)
      : fn;

    // 2. Appliquer circuit breaker si fourni
    if (circuitBreaker) {
      return circuitBreaker.execute(fnWithTimeout);
    }

    // Sinon, exécuter directement
    return fnWithTimeout();
  };

  // 3. Appliquer retry
  return withRetry(wrappedFn, retryConfig);
}
