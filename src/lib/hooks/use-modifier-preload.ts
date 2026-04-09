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

    // Start immediately in a microtask so it doesn't block the current render
    // but also doesn't wait until the browser is "idle" (which can be seconds away)
    Promise.resolve().then(() => preloadAsync());
  }, [itemIds]);
}
