/**
 * Cache Metrics Tracker
 *
 * Tracks cache performance and calculates cost savings
 */

import type { CacheMetrics } from './types';

export class CacheTracker {
  private totalRequests: number = 0;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private lookupTimes: number[] = [];
  private cacheSize: number = 0;
  private evictions: number = 0;
  private costSaved: number = 0;

  /**
   * Record a cache lookup
   */
  recordLookup(hit: boolean, lookupTimeMs: number, estimatedCostSaved?: number): void {
    this.totalRequests++;
    this.lookupTimes.push(lookupTimeMs);

    if (hit) {
      this.cacheHits++;
      if (estimatedCostSaved) {
        this.costSaved += estimatedCostSaved;
      }
    } else {
      this.cacheMisses++;
    }
  }

  /**
   * Update cache size
   */
  updateCacheSize(size: number): void {
    this.cacheSize = size;
  }

  /**
   * Record a cache eviction
   */
  recordEviction(): void {
    this.evictions++;
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    const hitRate = this.totalRequests > 0
      ? (this.cacheHits / this.totalRequests) * 100
      : 0;

    const avgLookupTime = this.lookupTimes.length > 0
      ? this.lookupTimes.reduce((sum, t) => sum + t, 0) / this.lookupTimes.length
      : 0;

    return {
      total_requests: this.totalRequests,
      cache_hits: this.cacheHits,
      cache_misses: this.cacheMisses,
      hit_rate_pct: hitRate,
      avg_cache_lookup_ms: avgLookupTime,
      cache_size_items: this.cacheSize,
      cache_evictions: this.evictions,
      cost_saved_usd: this.costSaved,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.totalRequests = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.lookupTimes = [];
    this.evictions = 0;
    this.costSaved = 0;
  }
}

/**
 * Factory function
 */
export function createCacheTracker(): CacheTracker {
  return new CacheTracker();
}
