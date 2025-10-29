/**
 * Tests d'intégration pour le système de résilience MCP
 *
 * Valide:
 * - Retry avec exponential backoff
 * - Circuit breaker (closed → open → half-open → closed)
 * - Timeout adaptatif
 * - Intégration complète (resilientCall)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  withRetry,
  CircuitBreaker,
  getCircuitBreaker,
  resetAllCircuitBreakers,
  withTimeout,
  withAdaptiveTimeout,
  resilientCall,
  CircuitBreakerOpenError,
  TimeoutError,
  delay,
} from '@/lib/mcp/resilience';

// ============================================================================
// Helpers
// ============================================================================

let callCount = 0;

function resetCallCount() {
  callCount = 0;
}

async function succeedAfterNAttempts(n: number): Promise<string> {
  callCount++;
  if (callCount < n) {
    throw new Error('ETIMEDOUT'); // Erreur retryable
  }
  return 'success';
}

async function alwaysFail(): Promise<string> {
  callCount++;
  throw new Error('FATAL_ERROR'); // Erreur non-retryable
}

async function slowFunction(delayMs: number): Promise<string> {
  await delay(delayMs);
  return 'success';
}

// ============================================================================
// TESTS - Retry
// ============================================================================

describe('Resilience - Retry', () => {
  beforeEach(() => {
    resetCallCount();
  });

  it('should succeed on first attempt', async () => {
    const result = await withRetry(async () => 'success', { maxRetries: 2 });

    expect(result).toBe('success');
    expect(callCount).toBe(0); // Pas d'incrémentation car succès immédiat
  });

  it('should retry and succeed after 2 attempts', async () => {
    const result = await withRetry(() => succeedAfterNAttempts(2), {
      maxRetries: 2,
      initialDelayMs: 100,
    });

    expect(result).toBe('success');
    expect(callCount).toBe(2); // 1 échec + 1 succès
  });

  it('should fail after max retries exceeded', async () => {
    await expect(
      withRetry(() => succeedAfterNAttempts(5), {
        maxRetries: 2, // Seulement 2 retries
        initialDelayMs: 100,
      })
    ).rejects.toThrow('ETIMEDOUT');

    expect(callCount).toBe(3); // 1 initial + 2 retries
  });

  it('should not retry on non-retryable errors', async () => {
    await expect(
      withRetry(() => alwaysFail(), {
        maxRetries: 2,
        initialDelayMs: 100,
        retryableErrors: ['ETIMEDOUT'], // FATAL_ERROR n'est pas retryable
      })
    ).rejects.toThrow('FATAL_ERROR');

    expect(callCount).toBe(1); // Pas de retry
  });

  it('should respect exponential backoff delays', async () => {
    const start = Date.now();

    await withRetry(() => succeedAfterNAttempts(3), {
      maxRetries: 2,
      initialDelayMs: 100,
      backoffMultiplier: 2,
    });

    const duration = Date.now() - start;

    // Delay 1: 100ms, Delay 2: 200ms → Total ~300ms minimum
    expect(duration).toBeGreaterThan(250);
    expect(callCount).toBe(3);
  });
});

// ============================================================================
// TESTS - Circuit Breaker
// ============================================================================

describe('Resilience - Circuit Breaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    resetCallCount();
    resetAllCircuitBreakers();
    cb = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      timeoutMs: 30000,
      halfOpenRetryMs: 100, // Court pour les tests
      name: 'test-cb',
    });
  });

  it('should start in closed state', () => {
    expect(cb.getState()).toBe('closed');
    expect(cb.getStats().consecutiveFailures).toBe(0);
  });

  it('should open after failure threshold reached', async () => {
    // 3 échecs consécutifs
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(() => alwaysFail())).rejects.toThrow();
    }

    expect(cb.getState()).toBe('open');
    expect(cb.getStats().consecutiveFailures).toBe(3);
  });

  it('should reject calls immediately when open', async () => {
    // Forcer l'ouverture
    cb.forceOpen();

    // Appel devrait être rejeté immédiatement
    await expect(cb.execute(async () => 'success')).rejects.toThrow(
      CircuitBreakerOpenError
    );

    expect(callCount).toBe(0); // Fonction jamais appelée
  });

  it('should transition to half-open after timeout', async () => {
    // Forcer ouverture
    cb.forceOpen();

    // Attendre le délai half-open
    await delay(150);

    // Devrait être en half-open maintenant
    await cb.execute(async () => 'success');

    expect(cb.getState()).toBe('half-open');
  });

  it('should close after success threshold in half-open', async () => {
    // Ouvrir le circuit
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(() => alwaysFail())).rejects.toThrow();
    }

    expect(cb.getState()).toBe('open');

    // Attendre passage en half-open
    await delay(150);

    // 2 succès consécutifs en half-open
    resetCallCount();
    await cb.execute(async () => 'success-1');
    await cb.execute(async () => 'success-2');

    // Devrait être fermé
    expect(cb.getState()).toBe('closed');
    expect(cb.getStats().consecutiveFailures).toBe(0);
  });

  it('should reopen if failure in half-open state', async () => {
    // Ouvrir le circuit
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(() => alwaysFail())).rejects.toThrow();
    }

    // Attendre passage en half-open
    await delay(150);

    // Un échec en half-open → ré-ouvrir
    resetCallCount();
    await expect(cb.execute(() => alwaysFail())).rejects.toThrow();

    expect(cb.getState()).toBe('open');
  });
});

// ============================================================================
// TESTS - Timeout
// ============================================================================

describe('Resilience - Timeout', () => {
  it('should resolve if function completes before timeout', async () => {
    const result = await withTimeout(slowFunction(100), 500);

    expect(result).toBe('success');
  });

  it('should reject with TimeoutError if timeout exceeded', async () => {
    await expect(withTimeout(slowFunction(500), 100)).rejects.toThrow(
      TimeoutError
    );
  });

  it('should use adaptive timeout based on mode', async () => {
    // Mode eco: 30s
    const ecoPromise = withAdaptiveTimeout(slowFunction(100), 'eco');
    await expect(ecoPromise).resolves.toBe('success');

    // Mode balanced: 60s
    const balancedPromise = withAdaptiveTimeout(slowFunction(100), 'balanced');
    await expect(balancedPromise).resolves.toBe('success');

    // Mode premium: 120s
    const premiumPromise = withAdaptiveTimeout(slowFunction(100), 'premium');
    await expect(premiumPromise).resolves.toBe('success');
  });
});

// ============================================================================
// TESTS - Integration (resilientCall)
// ============================================================================

describe('Resilience - Integration (resilientCall)', () => {
  beforeEach(() => {
    resetCallCount();
    resetAllCircuitBreakers();
  });

  it('should combine retry + circuit breaker + timeout', async () => {
    const cb = getCircuitBreaker('integration-test');

    const result = await resilientCall(() => succeedAfterNAttempts(2), {
      circuitBreaker: cb,
      timeoutMs: 5000,
      retryConfig: { maxRetries: 2, initialDelayMs: 100 },
    });

    expect(result).toBe('success');
    expect(callCount).toBe(2);
    expect(cb.getState()).toBe('closed');
  });

  it('should fail fast if circuit is open', async () => {
    const cb = getCircuitBreaker('fail-fast-test', {
      failureThreshold: 2,
      halfOpenRetryMs: 10000, // Long pour éviter half-open
    });

    // Ouvrir le circuit avec 2 échecs
    for (let i = 0; i < 2; i++) {
      await expect(
        resilientCall(() => alwaysFail(), { circuitBreaker: cb })
      ).rejects.toThrow();
    }

    expect(cb.getState()).toBe('open');

    // Prochain appel devrait échouer immédiatement
    resetCallCount();
    await expect(
      resilientCall(async () => 'should-not-be-called', { circuitBreaker: cb })
    ).rejects.toThrow(CircuitBreakerOpenError);

    expect(callCount).toBe(0); // Fonction jamais appelée
  });
});
