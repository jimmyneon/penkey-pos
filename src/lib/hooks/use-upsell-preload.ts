/**
 * Hook to preload upsell associations
 * Eagerly loads upsell data into RAM cache when org is available
 * Similar to use-modifier-preload.ts
 */

import { useEffect } from "react";
import { upsellRAMCache } from "@/lib/services/upsell-ram-cache";

export function useUpsellPreload(orgId: string | undefined) {
  useEffect(() => {
    if (!orgId || orgId === "skip") {
      return;
    }

    const preloadAsync = async () => {
      try {
        console.log(`[UpsellPreload] Preloading upsell associations for org ${orgId}`);
        await upsellRAMCache.preload(orgId);
        const stats = upsellRAMCache.getStats();
        console.log(`[UpsellPreload] ✓ Preload complete. Items: ${stats.size}, Valid: ${stats.valid}`);
      } catch (err) {
        console.error("[UpsellPreload] Failed to preload upsells:", err);
      }
    };

    preloadAsync();
  }, [orgId]);
}
