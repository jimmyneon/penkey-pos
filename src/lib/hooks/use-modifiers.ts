import { useState, useEffect } from "react";
import { getAll, putMany } from "@/lib/idb/db";
import { SyncManager } from "@/lib/services/sync-manager";
import { dataCache } from "@/lib/services/data-cache";

export interface Modifier {
  id: string;
  name: string;
  price: number;
  description: string | null;
  is_active: boolean;
}

export function useModifiers(orgId: string, forceRefresh: boolean = false) {
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    console.log("[useModifiers] orgId:", orgId, "forceRefresh:", forceRefresh);
    if (orgId && orgId !== "skip") {
      loadModifiers(forceRefresh);
    } else {
      console.log("[useModifiers] Skipping load - invalid orgId");
      setLoading(false);
    }
  }, [orgId, forceRefresh]);

  const loadModifiers = async (skipCache: boolean = false) => {
    try {
      setLoading(true);
      setFromCache(false);

      // Always load from IDB first for instant display
      try {
        const all = (await getAll("modifiers")) as any[];
        const filtered = all.filter((m) => m.org_id === orgId);
        if (filtered.length) {
          console.log("[useModifiers] IDB hit:", filtered.length);
          setModifiers(filtered);
          setFromCache(true);
          setLoading(false);
        }
      } catch (e) {
        console.error("[useModifiers] IDB error:", e);
      }

      // Check if we should sync from network
      const shouldSync = await SyncManager.shouldSync(orgId, 'MODIFIERS', skipCache);
      
      if (!shouldSync) {
        console.log("[useModifiers] Cache is fresh, skipping network sync");
        return;
      }

      // If offline, don't attempt network call
      if (!SyncManager.isOnline()) {
        console.log("[useModifiers] Offline, using cached data only");
        return;
      }

      // Fetch from network
      const doFetch = async () => {
        const response = await fetch(`/api/modifiers?org_id=${orgId}`);
        if (!response.ok) throw new Error("Failed to fetch modifiers");
        const data: Modifier[] = await response.json();
        console.log("[useModifiers] Loaded modifiers:", data.length);
        setModifiers(data);
        try {
          const withOrg = data.map((x: any) => ({ ...x, org_id: orgId }));
          await putMany("modifiers", withOrg);
          await SyncManager.markSynced(orgId, 'MODIFIERS');
        } catch (e) {
          console.error("[useModifiers] Failed to cache modifiers:", e);
        }
      };

      if (fromCache) {
        // Fire-and-forget background refresh
        doFetch().catch(() => {});
      } else {
        await doFetch();
      }
    } catch (err) {
      console.error("Failed to load modifiers:", err);
    } finally {
      setLoading(false);
    }
  };

  return { modifiers, loading, fromCache, reload: () => loadModifiers(true) };
}
