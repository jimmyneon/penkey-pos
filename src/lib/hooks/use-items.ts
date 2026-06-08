import { useState, useEffect } from "react";
import { dataCache } from "@/lib/services/data-cache";
import { getAll, putMany } from "@/lib/idb/db";
import { SyncManager } from "@/lib/services/sync-manager";

export interface Item {
  id: string;
  name: string;
  category_id: string | null;
  has_variants: boolean;
  base_price: number | null;
  image_url: string | null;
  is_active: boolean;
  sku: string | null;
  description: string | null;
  is_favourite?: boolean;
  favourite_position?: number;
  show_online?: boolean;
  categories: {
    name: string;
    color: string;
  } | null;
  item_variants: Array<{
    id: string;
    name: string;
    price: number;
    is_default: boolean;
  }>;
}

export function useItems(orgId: string, categoryId?: string, forceRefresh: boolean = false) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    console.log("[useItems] orgId:", orgId, "categoryId:", categoryId, "forceRefresh:", forceRefresh);
    if (orgId && orgId !== "skip") {
      loadItems(forceRefresh);
    } else {
      console.log("[useItems] Skipping load - invalid orgId");
      setLoading(false);
    }
  }, [orgId, categoryId, forceRefresh]);

  const loadItems = async (skipCache: boolean = false) => {
    try {
      setLoading(true);
      setFromCache(false);

      // Always load from IDB first for instant display
      try {
        const all = (await getAll("items")) as any[];
        const filtered = all.filter((it) => it.org_id === orgId);
        const byCategory = categoryId ? filtered.filter((it) => it.category_id === categoryId) : filtered;
        if (byCategory.length) {
          console.log("[useItems] IDB hit:", byCategory.length);
          setItems(byCategory);
          setFromCache(true);
          setLoading(false);
        }
      } catch (e) {
        console.error("[useItems] IDB error:", e);
      }

      // Check if we should sync from network
      const shouldSync = await SyncManager.shouldSync(orgId, 'ITEMS', skipCache);
      
      if (!shouldSync) {
        console.log("[useItems] Cache is fresh, skipping network sync");
        return;
      }

      // If offline, don't attempt network call
      if (!SyncManager.isOnline()) {
        console.log("[useItems] Offline, using cached data only");
        return;
      }

      // Fetch from network
      let url = `/api/items?org_id=${orgId}`;
      if (categoryId) url += `&category_id=${categoryId}`;
      
      const doFetch = async () => {
        console.log("[useItems] Fetching from API:", url);
        const resp = await fetch(url, {
          credentials: 'same-origin', // Include httpOnly cookies
        });
        console.log("[useItems] API response:", resp.status, resp.ok);
        if (!resp.ok) {
          const errorText = await resp.text();
          console.error("[useItems] API error:", resp.status, errorText);
          throw new Error(`Failed to fetch items: ${resp.status}`);
        }
        const data: Item[] = await resp.json();
        console.log("[useItems] Loaded items from API:", data.length, "items");
        setItems(data);
        setError(null);

        // Upsert into IDB with org scope
        try {
          const withOrg = data.map((x: any) => ({ ...x, org_id: orgId }));
          await putMany("items", withOrg);
          await SyncManager.markSynced(orgId, 'ITEMS');
          console.log("[useItems] Cached", withOrg.length, "items to IndexedDB");
        } catch (e) {
          console.error("[useItems] Failed to cache items:", e);
        }
      };

      if (fromCache) {
        // Fire-and-forget background refresh
        doFetch().catch(() => {});
      } else {
        await doFetch();
      }
    } catch (err: any) {
      console.error("Failed to load items:", err);
      if (!fromCache) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { items, loading, error, fromCache, reload: loadItems };
}
