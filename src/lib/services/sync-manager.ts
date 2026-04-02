/**
 * Smart Sync Manager
 * Coordinates data syncing with timestamp-based staleness checking
 * Prevents unnecessary network requests
 */

import { getMeta, setMeta } from "@/lib/idb/db";

// Cache TTL in milliseconds
// For POS: Catalog data rarely changes during a shift, so longer TTLs are better
export const CACHE_TTL = {
  ITEMS: 4 * 60 * 60 * 1000,        // 4 hours (catalog doesn't change mid-shift)
  CATEGORIES: 4 * 60 * 60 * 1000,   // 4 hours
  MODIFIERS: 24 * 60 * 60 * 1000,   // 24 hours (full shift - modifiers rarely change)
  RECEIPTS: 15 * 60 * 1000,         // 15 minutes (recent transactions)
  REPORTS: 10 * 60 * 1000,          // 10 minutes (stats update less frequently)
  REGISTER_SETTINGS: 8 * 60 * 60 * 1000, // 8 hours (settings rarely change)
  TAXES: 24 * 60 * 60 * 1000,       // 24 hours (very stable)
};

export type DataType = keyof typeof CACHE_TTL;

export class SyncManager {
  /**
   * Check if cached data is stale and needs refresh
   */
  static async isStale(orgId: string, dataType: DataType): Promise<boolean> {
    const key = `${dataType}_${orgId}_ts`;
    const lastSync = await getMeta<number>(key);
    
    if (!lastSync) {
      console.log(`[SyncManager] No sync timestamp for ${dataType}, needs sync`);
      return true;
    }

    const now = Date.now();
    const ttl = CACHE_TTL[dataType];
    const age = now - lastSync;
    const isStale = age > ttl;

    console.log(`[SyncManager] ${dataType} age: ${Math.round(age / 1000)}s, TTL: ${Math.round(ttl / 1000)}s, stale: ${isStale}`);
    
    return isStale;
  }

  /**
   * Mark data as synced with current timestamp
   */
  static async markSynced(orgId: string, dataType: DataType): Promise<void> {
    const key = `${dataType}_${orgId}_ts`;
    await setMeta(key, Date.now());
    console.log(`[SyncManager] Marked ${dataType} as synced`);
  }

  /**
   * Check if we should sync based on staleness and network status
   */
  static async shouldSync(orgId: string, dataType: DataType, forceRefresh: boolean = false): Promise<boolean> {
    // Always sync if force refresh
    if (forceRefresh) {
      console.log(`[SyncManager] Force refresh requested for ${dataType}`);
      return true;
    }

    // Check if online
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log(`[SyncManager] Offline, skipping sync for ${dataType}`);
      return false;
    }

    // Check staleness
    return await this.isStale(orgId, dataType);
  }

  /**
   * Get last sync timestamp for display
   */
  static async getLastSync(orgId: string, dataType: DataType): Promise<number | null> {
    const key = `${dataType}_${orgId}_ts`;
    return await getMeta<number>(key);
  }

  /**
   * Clear sync timestamp (force next check to sync)
   */
  static async clearSyncTimestamp(orgId: string, dataType: DataType): Promise<void> {
    const key = `${dataType}_${orgId}_ts`;
    await setMeta(key, 0);
    console.log(`[SyncManager] Cleared sync timestamp for ${dataType}`);
  }

  /**
   * Get sync status for all data types
   */
  static async getSyncStatus(orgId: string): Promise<Record<DataType, { lastSync: number | null; stale: boolean }>> {
    const status: any = {};
    
    for (const dataType of Object.keys(CACHE_TTL) as DataType[]) {
      const lastSync = await this.getLastSync(orgId, dataType);
      const stale = await this.isStale(orgId, dataType);
      status[dataType] = { lastSync, stale };
    }

    return status;
  }

  /**
   * Check if we're online
   */
  static isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }
}
