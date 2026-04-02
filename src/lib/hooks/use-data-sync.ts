import { useState, useEffect } from "react";
import { dataCache } from "@/lib/services/data-cache";

export function useDataSync(orgId: string) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);

  // Initialize lastSync from cache on mount
  useEffect(() => {
    if (!orgId || orgId === "skip") return;

    const cacheInfo = dataCache.getCacheInfo(orgId);
    const timestamps = Object.values(cacheInfo).map(info => info.timestamp);
    
    if (timestamps.length > 0) {
      // Use the most recent timestamp
      const mostRecent = Math.max(...timestamps);
      setLastSync(mostRecent);
    }
  }, [orgId]);

  const syncData = async (): Promise<void> => {
    if (!orgId || orgId === "skip") {
      console.log("[DataSync] Invalid orgId, skipping sync");
      return;
    }

    setSyncing(true);

    try {
      // Fetch categories
      const categoriesResponse = await fetch(`/api/categories?org_id=${orgId}`);
      if (categoriesResponse.ok) {
        const categories = await categoriesResponse.json();
        dataCache.set(orgId, "categories", categories);
        console.log("[DataSync] Synced categories:", categories.length);
      }

      // Fetch items
      const itemsResponse = await fetch(`/api/items?org_id=${orgId}`);
      if (itemsResponse.ok) {
        const items = await itemsResponse.json();
        dataCache.set(orgId, "items", items);
        console.log("[DataSync] Synced items:", items.length);
      }

      // Fetch modifiers
      const modifiersResponse = await fetch(`/api/modifiers?org_id=${orgId}`);
      if (modifiersResponse.ok) {
        const modifiers = await modifiersResponse.json();
        dataCache.set(orgId, "modifiers", modifiers);
        console.log("[DataSync] Synced modifiers:", modifiers.length);
      }

      // Fetch daily stats
      const statsResponse = await fetch(`/api/stats/daily?org_id=${orgId}`);
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        // Use shorter TTL for stats (1 hour)
        const statsCache = new (await import("@/lib/services/data-cache")).DataCacheService({ ttlHours: 1 });
        statsCache.set(orgId, "daily_stats", stats);
        console.log("[DataSync] Synced daily stats");
      }

      setLastSync(Date.now());
    } catch (err) {
      console.error("[DataSync] Sync failed:", err);
      throw err;
    } finally {
      setSyncing(false);
    }
  };

  const getCacheInfo = () => {
    return dataCache.getCacheInfo(orgId);
  };

  const clearCache = () => {
    dataCache.clearOrg(orgId);
    setLastSync(null);
  };

  return {
    syncing,
    lastSync,
    syncData,
    getCacheInfo,
    clearCache,
  };
}
