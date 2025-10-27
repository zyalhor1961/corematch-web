/**
 * Circuit Breaker Pattern
 *
 * Protège les services externes contre les cascades de failures.
 *
 * États:
 * - CLOSED: Normal, tous les appels passent
 * - OPEN: Circuit ouvert, rejette immédiatement sans appeler le service
 * - HALF-OPEN: Test avec 1 appel, puis décide si fermer ou ré-ouvrir
 *
 * Flow:
 * CLOSED --(3 failures)--> OPEN --(60s)--> HALF-OPEN --(2 success)--> CLOSED
 *                                              |
 *                                          (1 failure)
 *                                              |
 *                                              v
 *                                            OPEN
 */

import type {
  CircuitBreakerConfig,
  CircuitState,
  CircuitBreakerStats,
} from './types';
import { DEFAULT_CIRCUIT_BREAKER_CONFIG, CircuitBreakerOpenError } from './types';

/**
 * Circuit Breaker pour protéger contre les cascades de failures
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime: number | null = null;
  private totalCalls = 0;
  private totalSuccesses = 0;
  private totalFailures = 0;
  private totalRejected = 0;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    if (!this.config.name) {
      this.config.name = `circuit-${Date.now()}`;
    }
  }

  /**
   * Exécute une fonction avec protection circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    // Si le circuit est ouvert, vérifier si on peut passer en half-open
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - (this.lastFailureTime || 0);

      if (timeSinceLastFailure >= this.config.halfOpenRetryMs) {
        // Passer en half-open pour tester
        console.log(`[CircuitBreaker:${this.config.name}] 🟡 Transitioning to HALF-OPEN`);
        this.state = 'half-open';
        this.consecutiveSuccesses = 0;
      } else {
        // Circuit toujours ouvert, rejeter immédiatement
        this.totalRejected++;
        console.warn(
          `[CircuitBreaker:${this.config.name}] 🔴 OPEN - Request rejected ` +
          `(${this.totalRejected} total rejected)`
        );
        throw new CircuitBreakerOpenError(this.config.name || 'unknown');
      }
    }

    try {
      // Exécuter la fonction
      const result = await fn();

      // Succès !
      this.onSuccess();

      return result;
    } catch (error) {
      // Échec !
      this.onFailure();

      throw error;
    }
  }

  /**
   * Gère un succès
   */
  private onSuccess(): void {
    this.totalSuccesses++;

    if (this.state === 'half-open') {
      // En half-open, on compte les succès consécutifs
      this.consecutiveSuccesses++;

      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        // Assez de succès, fermer le circuit
        console.log(
          `[CircuitBreaker:${this.config.name}] ✅ CLOSED after ` +
          `${this.consecutiveSuccesses} consecutive successes`
        );
        this.state = 'closed';
        this.consecutiveFailures = 0;
        this.consecutiveSuccesses = 0;
        this.lastFailureTime = null;
      }
    } else if (this.state === 'closed') {
      // En closed, un succès reset les failures consécutives
      this.consecutiveFailures = 0;
    }
  }

  /**
   * Gère un échec
   */
  private onFailure(): void {
    this.totalFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      // En half-open, un seul échec ré-ouvre le circuit
      console.warn(
        `[CircuitBreaker:${this.config.name}] 🔴 OPEN (failure in half-open state)`
      );
      this.state = 'open';
      this.consecutiveSuccesses = 0;
      this.consecutiveFailures++;
    } else if (this.state === 'closed') {
      // En closed, on compte les échecs consécutifs
      this.consecutiveFailures++;

      if (this.consecutiveFailures >= this.config.failureThreshold) {
        // Trop d'échecs, ouvrir le circuit
        console.warn(
          `[CircuitBreaker:${this.config.name}] 🔴 OPEN after ` +
          `${this.consecutiveFailures} consecutive failures`
        );
        this.state = 'open';
      }
    }
  }

  /**
   * Obtenir l'état actuel
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Obtenir les statistiques
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      totalCalls: this.totalCalls,
      totalSuccesses: this.totalSuccesses,
      totalFailures: this.totalFailures,
      totalRejected: this.totalRejected,
    };
  }

  /**
   * Reset le circuit breaker (pour tests)
   */
  reset(): void {
    this.state = 'closed';
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = null;
    this.totalCalls = 0;
    this.totalSuccesses = 0;
    this.totalFailures = 0;
    this.totalRejected = 0;

    console.log(`[CircuitBreaker:${this.config.name}] 🔄 Reset to CLOSED`);
  }

  /**
   * Forcer l'ouverture du circuit (pour tests)
   */
  forceOpen(): void {
    this.state = 'open';
    this.lastFailureTime = Date.now();
    console.log(`[CircuitBreaker:${this.config.name}] 🔴 Forced OPEN`);
  }

  /**
   * Forcer la fermeture du circuit (pour tests)
   */
  forceClose(): void {
    this.state = 'closed';
    this.consecutiveFailures = 0;
    this.lastFailureTime = null;
    console.log(`[CircuitBreaker:${this.config.name}] ✅ Forced CLOSED`);
  }
}

/**
 * Circuit breakers globaux par provider (singleton)
 */
const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Obtenir ou créer un circuit breaker pour un provider
 */
export function getCircuitBreaker(
  name: string,
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker({ ...config, name }));
  }
  return circuitBreakers.get(name)!;
}

/**
 * Reset tous les circuit breakers (pour tests)
 */
export function resetAllCircuitBreakers(): void {
  circuitBreakers.forEach((cb) => cb.reset());
  circuitBreakers.clear();
}
