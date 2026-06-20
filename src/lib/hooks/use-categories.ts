import { useState, useEffect } from "react";
import { dataCache } from "@/lib/services/data-cache";
import { getAll, putMany } from "@/lib/idb/db";
import { SyncManager } from "@/lib/services/sync-manager";

export interface Category {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  description: string | null;
  is_active: boolean;
  type?: "drink" | "food" | "retail" | "other";
  icon?: string;
  icon_color?: string;
}

export function useCategories(orgId: string, forceRefresh: boolean = false) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    console.log("[useCategories] orgId:", orgId, "forceRefresh:", forceRefresh);
    if (orgId && orgId !== "skip") {
      loadCategories(forceRefresh);
    } else {
      console.log("[useCategories] Skipping load - invalid orgId");
      setLoading(false);
    }
  }, [orgId, forceRefresh]);

  const loadCategories = async (skipCache: boolean = false) => {
    let loadedFromCache = false;
    try {
      setLoading(true);
      setFromCache(false);

      // Always load from IDB first for instant display
      try {
        const all = (await getAll("categories")) as any[];
        const filtered = all.filter((c) => c.org_id === orgId);
        if (filtered.length) {
          console.log("[useCategories] IDB hit:", filtered.length);
          setCategories(filtered);
          loadedFromCache = true;
          setFromCache(true);
          setLoading(false);
        }
      } catch (e) {
        console.error("[useCategories] IDB error:", e);
      }

      // Check if we should sync from network
      const shouldSync = await SyncManager.shouldSync(orgId, 'CATEGORIES', skipCache);
      
      if (!shouldSync) {
        console.log("[useCategories] Cache is fresh, skipping network sync");
        return;
      }

      // If offline, don't attempt network call
      if (!SyncManager.isOnline()) {
        console.log("[useCategories] Offline, using cached data only");
        return;
      }

      // Fetch from network
      const doFetch = async () => {
        const response = await fetch(`/api/categories?org_id=${orgId}`, {
          credentials: 'include',
        });
        if (!response.ok) throw new Error("Failed to fetch categories");
        const data: Category[] = await response.json();
        console.log("[useCategories] Loaded categories from API:", data.length);
        setCategories(data);
        try {
          const withOrg = data.map((x: any) => ({ ...x, org_id: orgId }));
          await putMany("categories", withOrg);
          await SyncManager.markSynced(orgId, 'CATEGORIES');
        } catch (e) {
          console.error("[useCategories] Failed to cache categories:", e);
        }
      };

      if (loadedFromCache) {
        // Fire-and-forget background refresh — data already showing from IDB
        doFetch().catch(() => {});
      } else {
        await doFetch();
      }
    } catch (err) {
      console.error("Failed to load categories:", err);
    } finally {
      setLoading(false);
    }
  };

  return { categories, loading, fromCache, reload: loadCategories };
}
