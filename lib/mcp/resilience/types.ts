/**
 * Types communs pour le système de résilience
 */

/**
 * Configuration du retry avec exponential backoff
 */
export interface RetryConfig {
  /** Nombre maximum de tentatives (sans compter l'appel initial) */
  maxRetries: number;

  /** Délai initial en millisecondes */
  initialDelayMs: number;

  /** Délai maximum en millisecondes */
  maxDelayMs: number;

  /** Multiplicateur pour l'exponential backoff */
  backoffMultiplier: number;

  /** Codes d'erreur à retry (HTTP codes, error codes) */
  retryableErrors: string[];

  /** Fonction pour déterminer si une erreur est retryable */
  isRetryable?: (error: any) => boolean;
}

/**
 * Configuration par défaut pour retry
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    // Network errors
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ENETUNREACH',

    // HTTP errors (rate limiting, server errors)
    '429', // Too Many Requests
    '500', // Internal Server Error
    '502', // Bad Gateway
    '503', // Service Unavailable
    '504', // Gateway Timeout
  ],
};

/**
 * États du circuit breaker
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Configuration du circuit breaker
 */
export interface CircuitBreakerConfig {
  /** Nombre d'échecs consécutifs avant d'ouvrir le circuit */
  failureThreshold: number;

  /** Nombre de succès consécutifs en half-open pour fermer le circuit */
  successThreshold: number;

  /** Timeout en millisecondes pour un appel */
  timeoutMs: number;

  /** Durée en millisecondes avant de passer de open à half-open */
  halfOpenRetryMs: number;

  /** Nom du circuit (pour logging) */
  name?: string;
}

/**
 * Configuration par défaut pour circuit breaker
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  successThreshold: 2,
  timeoutMs: 30000,
  halfOpenRetryMs: 60000,
};

/**
 * Statistiques du circuit breaker
 */
export interface CircuitBreakerStats {
  /** État actuel du circuit */
  state: CircuitState;

  /** Nombre d'échecs consécutifs */
  consecutiveFailures: number;

  /** Nombre de succès consécutifs (en half-open) */
  consecutiveSuccesses: number;

  /** Timestamp de la dernière erreur */
  lastFailureTime: number | null;

  /** Nombre total d'appels */
  totalCalls: number;

  /** Nombre total de succès */
  totalSuccesses: number;

  /** Nombre total d'échecs */
  totalFailures: number;

  /** Nombre d'appels rejetés (circuit open) */
  totalRejected: number;
}

/**
 * Erreur lancée quand le circuit est ouvert
 */
export class CircuitBreakerOpenError extends Error {
  constructor(circuitName: string) {
    super(`Circuit breaker '${circuitName}' is open`);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Erreur lancée quand un timeout est dépassé
 */
export class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}
