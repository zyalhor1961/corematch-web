/**
 * Timeout Utilities
 *
 * Permet d'ajouter des timeouts aux opérations asynchrones
 */

import { TimeoutError } from './types';

/**
 * Wrapper pour ajouter un timeout à une promise
 *
 * @param promise Promise à exécuter
 * @param timeoutMs Timeout en millisecondes
 * @returns Résultat de la promise
 * @throws TimeoutError si le timeout est dépassé
 *
 * @example
 * const result = await withTimeout(
 *   fetch('https://api.example.com'),
 *   5000 // 5s timeout
 * );
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    // Timer pour le timeout
    const timer = setTimeout(() => {
      reject(new TimeoutError(timeoutMs));
    }, timeoutMs);

    // Exécuter la promise
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Wrapper pour ajouter un timeout adaptatif basé sur le mode d'analyse
 *
 * @param promise Promise à exécuter
 * @param mode Mode d'analyse (eco/balanced/premium)
 * @returns Résultat de la promise
 *
 * @example
 * const result = await withAdaptiveTimeout(
 *   callAPI(),
 *   'balanced' // 60s timeout
 * );
 */
export function withAdaptiveTimeout<T>(
  promise: Promise<T>,
  mode: 'eco' | 'balanced' | 'premium'
): Promise<T> {
  const TIMEOUTS = {
    eco: 30_000,      // 30s
    balanced: 60_000, // 60s
    premium: 120_000, // 120s
  };

  const timeoutMs = TIMEOUTS[mode];

  console.log(`[Timeout] Using ${mode} mode timeout: ${timeoutMs}ms`);

  return withTimeout(promise, timeoutMs);
}

/**
 * Créer une promise qui se résout après un délai
 *
 * @param ms Délai en millisecondes
 * @returns Promise qui se résout après le délai
 *
 * @example
 * await delay(1000); // Attendre 1 seconde
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
