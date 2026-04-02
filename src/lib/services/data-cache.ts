/**
 * Data Cache Service for POS
 * Provides localStorage-based caching with TTL and org-scoping
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
}

export interface CacheConfig {
  ttlHours: number;
  version: string;
}

const DEFAULT_CONFIG: CacheConfig = {
  ttlHours: 24,
  version: "1.0",
};

export class DataCacheService {
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate cache key for org-specific data
   */
  private getCacheKey(orgId: string, dataType: string): string {
    return `pos_cache_${orgId}_${dataType}`;
  }

  /**
   * Get cached data if available and not stale
   */
  get<T>(orgId: string, dataType: string): T | null {
    try {
      const key = this.getCacheKey(orgId, dataType);
      const cached = localStorage.getItem(key);

      if (!cached) {
        console.log(`[DataCache] No cache found for ${dataType}`);
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(cached);

      // Check version
      if (entry.version !== this.config.version) {
        console.log(`[DataCache] Version mismatch for ${dataType}, clearing`);
        this.clear(orgId, dataType);
        return null;
      }

      // Check if stale
      if (this.isStale(entry.timestamp)) {
        console.log(`[DataCache] Stale cache for ${dataType}`);
        return null;
      }

      console.log(`[DataCache] Cache hit for ${dataType}`);
      return entry.data;
    } catch (err) {
      console.error(`[DataCache] Error reading cache:`, err);
      return null;
    }
  }

  /**
   * Set cached data with timestamp
   */
  set<T>(orgId: string, dataType: string, data: T): void {
    try {
      const key = this.getCacheKey(orgId, dataType);
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        version: this.config.version,
      };

      localStorage.setItem(key, JSON.stringify(entry));
      console.log(`[DataCache] Cached ${dataType} for org ${orgId}`);
    } catch (err) {
      console.error(`[DataCache] Error writing cache:`, err);
    }
  }

  /**
   * Clear specific cache entry
   */
  clear(orgId: string, dataType: string): void {
    try {
      // localStorage only exists in browser, not in API routes
      if (typeof window === 'undefined') {
        console.log(`[DataCache] Skipping cache clear (server-side)`);
        return;
      }
      const key = this.getCacheKey(orgId, dataType);
      localStorage.removeItem(key);
      console.log(`[DataCache] Cleared cache for ${dataType}`);
    } catch (err) {
      console.error(`[DataCache] Error clearing cache:`, err);
    }
  }

  /**
   * Clear all cache for an organization
   */
  clearOrg(orgId: string): void {
    try {
      // localStorage only exists in browser, not in API routes
      if (typeof window === 'undefined') {
        console.log(`[DataCache] Skipping org cache clear (server-side)`);
        return;
      }
      const prefix = `pos_cache_${orgId}_`;
      const keys = Object.keys(localStorage);

      keys.forEach((key) => {
        if (key.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      });

      console.log(`[DataCache] Cleared all cache for org ${orgId}`);
    } catch (err) {
      console.error(`[DataCache] Error clearing org cache:`, err);
    }
  }

  /**
   * Clear all POS cache
   */
  clearAll(): void {
    try {
      const prefix = "pos_cache_";
      const keys = Object.keys(localStorage);

      keys.forEach((key) => {
        if (key.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      });

      console.log(`[DataCache] Cleared all POS cache`);
    } catch (err) {
      console.error(`[DataCache] Error clearing all cache:`, err);
    }
  }

  /**
   * Check if timestamp is stale based on TTL
   */
  isStale(timestamp: number): boolean {
    const now = Date.now();
    const ttlMs = this.config.ttlHours * 60 * 60 * 1000;
    return now - timestamp > ttlMs;
  }

  /**
   * Get cache timestamp for display
   */
  getTimestamp(orgId: string, dataType: string): number | null {
    try {
      const key = this.getCacheKey(orgId, dataType);
      const cached = localStorage.getItem(key);

      if (!cached) return null;

      const entry: CacheEntry<any> = JSON.parse(cached);
      return entry.timestamp;
    } catch (err) {
      return null;
    }
  }

  /**
   * Get cache info for all data types
   */
  getCacheInfo(orgId: string): Record<string, { timestamp: number; stale: boolean }> {
    const dataTypes = ["items", "categories", "modifiers", "popular_breakfast", "popular_lunch", "popular_dinner", "popular_late_night"];
    const info: Record<string, { timestamp: number; stale: boolean }> = {};

    dataTypes.forEach((type) => {
      const timestamp = this.getTimestamp(orgId, type);
      if (timestamp) {
        info[type] = {
          timestamp,
          stale: this.isStale(timestamp),
        };
      }
    });

    return info;
  }

  /**
   * Check if timestamp is stale with custom TTL hours
   */
  isStaleCustom(timestamp: number, ttlHours: number): boolean {
    const now = Date.now();
    const ttlMs = ttlHours * 60 * 60 * 1000;
    return now - timestamp > ttlMs;
  }

  /**
   * Invalidate popular items cache (call after completing a sale)
   */
  invalidatePopularItems(orgId: string): void {
    try {
      const timeSegments = ["breakfast", "lunch", "dinner", "late_night"];
      timeSegments.forEach((segment) => {
        this.clear(orgId, `popular_${segment}`);
      });
      console.log(`[DataCache] Invalidated popular items cache for org ${orgId}`);
    } catch (err) {
      console.error(`[DataCache] Error invalidating popular items:`, err);
    }
  }

  /**
   * Invalidate daily stats cache (call after completing a sale)
   */
  invalidateDailyStats(orgId: string): void {
    try {
      this.clear(orgId, "daily_stats");
      console.log(`[DataCache] Invalidated daily stats cache for org ${orgId}`);
    } catch (err) {
      console.error(`[DataCache] Error invalidating daily stats:`, err);
    }
  }
}

// Export singleton instance
export const dataCache = new DataCacheService();
