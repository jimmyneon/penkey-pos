/**
 * In-Memory Modifier Cache
 * Keeps frequently accessed modifiers in RAM for instant access
 * Syncs with IndexedDB for persistence
 */

interface ModifierOption {
  id: string;
  name: string;
  price_adjustment: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  selection_type: string;
  min_selections: number;
  max_selections: number | null;
  modifier_options: ModifierOption[];
}

interface CachedModifiers {
  itemId: string;
  groups: ModifierGroup[];
  timestamp: number;
}

class ModifierRAMCache {
  private cache = new Map<string, CachedModifiers>();
  private maxSize = 100; // Keep up to 100 items in RAM
  private ttl = 1000 * 60 * 60; // 1 hour TTL

  /**
   * Get modifiers from RAM cache
   */
  get(itemId: string): ModifierGroup[] | null {
    const cached = this.cache.get(itemId);
    
    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(itemId);
      return null;
    }

    return cached.groups;
  }

  /**
   * Set modifiers in RAM cache
   */
  set(itemId: string, groups: ModifierGroup[]): void {
    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(itemId, {
      itemId,
      groups,
      timestamp: Date.now(),
    });
  }

  /**
   * Preload multiple items' modifiers into RAM
   */
  async preload(itemIds: string[]): Promise<void> {
    const { getByKey } = await import('@/lib/idb/db');
    const uncached = itemIds.filter(id => !this.cache.has(id));
    if (uncached.length === 0) return;
    // Parallel IDB reads — much faster than sequential for large catalogs
    await Promise.all(
      uncached.map(async (itemId) => {
        try {
          const row: any = await getByKey('item_modifier_groups', itemId as any);
          if (row?.groups) {
            this.set(itemId, row.groups);
          }
        } catch (err) {
          console.log(`[ModifierRAMCache] Failed to preload item ${itemId}:`, err);
        }
      })
    );
  }

  /**
   * Invalidate a specific item from cache
   */
  invalidate(itemId: string): void {
    this.cache.delete(itemId);
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getStats(): { size: number; items: string[] } {
    return {
      size: this.cache.size,
      items: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const modifierRAMCache = new ModifierRAMCache();
