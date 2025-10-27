/**
 * Cache Store Interface and Implementations
 *
 * Supports:
 * - In-Memory (MVP, development)
 * - Redis (Production, coming soon)
 * - Supabase (Alternative, coming soon)
 */

import type { AggregatedResult } from '@/lib/cv-analysis/types';

/**
 * Interface générique de cache
 */
export interface CacheStore {
  get(key: string): Promise<AggregatedResult | null>;
  set(key: string, value: AggregatedResult, ttlSeconds?: number): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  size(): Promise<number>;
}

/**
 * Entrée de cache avec métadonnées
 */
interface CacheEntry {
  value: AggregatedResult;
  expiresAt: number; // timestamp
  createdAt: number;
}

/**
 * In-Memory Cache Store (MVP)
 *
 * ⚠️ LIMITATIONS:
 * - Perdu au restart serveur
 * - Ne scale pas horizontalement (multi-instances)
 * - Pas de persistence
 *
 * ✅ AVANTAGES:
 * - Simple, pas de dépendances externes
 * - Rapide (pas de I/O réseau)
 * - Parfait pour dev et MVP
 */
export class InMemoryCacheStore implements CacheStore {
  private store: Map<string, CacheEntry>;
  private readonly defaultTTL: number; // En secondes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: { defaultTTL?: number; enableAutoCleanup?: boolean } = {}) {
    this.store = new Map();
    this.defaultTTL = options.defaultTTL || 3600; // 1h par défaut

    // Auto-cleanup des entrées expirées (toutes les 5 min)
    if (options.enableAutoCleanup !== false) {
      this.startAutoCleanup();
    }
  }

  async get(key: string): Promise<AggregatedResult | null> {
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    // Vérifier expiration
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: AggregatedResult, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds || this.defaultTTL;
    const expiresAt = Date.now() + ttl * 1000;

    this.store.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
    });
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async size(): Promise<number> {
    // Nettoyer les entrées expirées avant de compter
    await this.cleanup();
    return this.store.size;
  }

  /**
   * Nettoyer les entrées expirées
   */
  private async cleanup(): Promise<number> {
    const now = Date.now();
    let deletedCount = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Démarrer le nettoyage automatique
   */
  private startAutoCleanup(): void {
    this.cleanupInterval = setInterval(
      async () => {
        const deleted = await this.cleanup();
        if (deleted > 0) {
          console.log(`[InMemoryCache] Cleaned up ${deleted} expired entries`);
        }
      },
      5 * 60 * 1000
    ); // Toutes les 5 minutes
  }

  /**
   * Arrêter le nettoyage automatique
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Stats du cache (pour monitoring)
   */
  async getStats(): Promise<{
    size: number;
    oldestEntryAge: number | null;
    newestEntryAge: number | null;
  }> {
    await this.cleanup();

    if (this.store.size === 0) {
      return { size: 0, oldestEntryAge: null, newestEntryAge: null };
    }

    const now = Date.now();
    let oldestCreatedAt = Infinity;
    let newestCreatedAt = 0;

    for (const entry of this.store.values()) {
      oldestCreatedAt = Math.min(oldestCreatedAt, entry.createdAt);
      newestCreatedAt = Math.max(newestCreatedAt, entry.createdAt);
    }

    return {
      size: this.store.size,
      oldestEntryAge: now - oldestCreatedAt,
      newestEntryAge: now - newestCreatedAt,
    };
  }
}

/**
 * Singleton instance (global pour toute l'app)
 */
let globalCacheStore: CacheStore | null = null;

/**
 * Récupérer ou créer l'instance de cache globale
 */
export function getCacheStore(): CacheStore {
  if (!globalCacheStore) {
    globalCacheStore = new InMemoryCacheStore({
      defaultTTL: 3600, // 1h
      enableAutoCleanup: true,
    });

    console.log('[CacheStore] In-memory cache initialized (TTL: 1h)');
  }

  return globalCacheStore;
}

/**
 * Reset du cache (pour tests uniquement)
 */
export function resetCacheStore(): void {
  if (globalCacheStore && globalCacheStore instanceof InMemoryCacheStore) {
    globalCacheStore.stopAutoCleanup();
  }
  globalCacheStore = null;
}
