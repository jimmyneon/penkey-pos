/**
 * In-Memory Upsell Cache
 * Keeps learned item associations in RAM for instant upsell suggestions
 * Similar to modifier-ram-cache.ts but for upsell data
 */

interface ItemPair {
  item_a_id: string;
  item_b_id: string;
  frequency: number;
  confidence: number;
}

interface CachedAssociations {
  associations: Map<string, ItemPair[]>; // item_id -> related items
  timestamp: number;
}

class UpsellRAMCache {
  private cache: CachedAssociations | null = null;
  private ttl = 1000 * 60 * 60 * 2; // 2 hour TTL (upsells change less frequently)
  private loading = false;
  private loadPromise: Promise<void> | null = null;

  /**
   * Check if cache is valid
   */
  private isValid(): boolean {
    if (!this.cache) return false;
    const age = Date.now() - this.cache.timestamp;
    return age < this.ttl;
  }

  /**
   * Get associations for an item from RAM cache
   */
  get(itemId: string): ItemPair[] | null {
    if (!this.isValid()) {
      return null;
    }
    return this.cache!.associations.get(itemId) || null;
  }

  /**
   * Get all associations (for building suggestions)
   */
  getAll(): Map<string, ItemPair[]> | null {
    if (!this.isValid()) {
      return null;
    }
    return this.cache!.associations;
  }

  /**
   * Preload upsell associations into RAM from IndexedDB
   */
  async preload(orgId: string): Promise<void> {
    // If already loading, wait for that to finish
    if (this.loading && this.loadPromise) {
      return this.loadPromise;
    }

    // If cache is still valid, no need to reload
    if (this.isValid()) {
      console.log('[UpsellRAMCache] Cache still valid, skipping preload');
      return;
    }

    this.loading = true;
    this.loadPromise = this._doPreload(orgId);
    
    try {
      await this.loadPromise;
    } finally {
      this.loading = false;
      this.loadPromise = null;
    }
  }

  private async _doPreload(orgId: string): Promise<void> {
    try {
      console.log('[UpsellRAMCache] Preloading upsell associations...');
      
      // Try to get from IndexedDB first
      const { getByKey } = await import('@/lib/idb/db');
      const cached: any = await getByKey('meta', `upsell_associations_${orgId}` as any);
      
      if (cached?.data && cached?.timestamp) {
        const age = Date.now() - cached.timestamp;
        if (age < this.ttl) {
          // Convert plain object back to Map
          const associations = new Map<string, ItemPair[]>();
          for (const [key, value] of Object.entries(cached.data)) {
            associations.set(key, value as ItemPair[]);
          }
          
          this.cache = {
            associations,
            timestamp: cached.timestamp,
          };
          
          console.log(`[UpsellRAMCache] ✓ Loaded ${associations.size} items from IndexedDB`);
          return;
        }
      }

      // Cache miss or stale - fetch from API
      console.log('[UpsellRAMCache] Fetching from API...');
      const response = await fetch(`/api/analytics/item-associations?org_id=${orgId}`);
      
      if (!response.ok) {
        console.warn(`[UpsellRAMCache] API error: ${response.status}`);
        return;
      }

      const data: ItemPair[] = await response.json();
      console.log(`[UpsellRAMCache] API returned ${data.length} association pairs`);
      
      // Build associations map
      const associations = new Map<string, ItemPair[]>();
      data.forEach(pair => {
        if (!associations.has(pair.item_a_id)) {
          associations.set(pair.item_a_id, []);
        }
        associations.get(pair.item_a_id)!.push(pair);
      });

      this.cache = {
        associations,
        timestamp: Date.now(),
      };

      // Cache in IndexedDB for next time
      try {
        const { getDB } = await import('@/lib/idb/db');
        const db = await getDB();
        const cacheData = Object.fromEntries(associations);
        await db.put('meta', {
          key: `upsell_associations_${orgId}`,
          data: cacheData,
          timestamp: Date.now(),
        });
        console.log(`[UpsellRAMCache] ✓ Cached ${associations.size} items in IndexedDB`);
      } catch (err) {
        console.error('[UpsellRAMCache] Failed to cache in IndexedDB:', err);
      }

    } catch (err) {
      console.error('[UpsellRAMCache] Preload failed:', err);
    }
  }

  /**
   * Clear cache (force reload on next access)
   */
  clear(): void {
    this.cache = null;
    console.log('[UpsellRAMCache] Cache cleared');
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      loaded: this.cache !== null,
      size: this.cache?.associations.size || 0,
      age: this.cache ? Date.now() - this.cache.timestamp : 0,
      valid: this.isValid(),
    };
  }

  /**
   * Check if cache is ready
   */
  isReady(): boolean {
    return this.isValid();
  }
}

// Singleton instance
export const upsellRAMCache = new UpsellRAMCache();
