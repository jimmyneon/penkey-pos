/**
 * Hook to preload modifiers for items
 * Eagerly loads modifiers into RAM cache when items are available
 */

import { useEffect } from "react";
import { modifierRAMCache } from "@/lib/services/modifier-ram-cache";

export function useModifierPreload(itemIds: string[] | undefined) {
  useEffect(() => {
    if (!itemIds || itemIds.length === 0) {
      return;
    }

    // Preload modifiers in background (non-blocking)
    const preloadAsync = async () => {
      try {
        console.log(`[ModifierPreload] Preloading modifiers for ${itemIds.length} items`);
        await modifierRAMCache.preload(itemIds);
        const stats = modifierRAMCache.getStats();
        console.log(`[ModifierPreload] ✓ Preload complete. Cache size: ${stats.size}`);
      } catch (err) {
        console.error("[ModifierPreload] Failed to preload modifiers:", err);
      }
    };

    // Use requestIdleCallback if available for non-blocking preload
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => preloadAsync());
    } else {
      // Fallback to setTimeout for browsers without requestIdleCallback
      setTimeout(() => preloadAsync(), 100);
    }
  }, [itemIds]);
}
