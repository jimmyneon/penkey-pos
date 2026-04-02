/**
 * Modifier Cache Service
 * Handles cached modifier data with item associations
 */

import { dataCache } from "./data-cache";

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

interface ItemModifier {
  item_id: string;
  modifier_group_id: string;
  sort_order: number;
}

/**
 * Get modifiers for a specific item from cache
 * Falls back to API if cache miss
 */
export async function getItemModifiersFromCache(
  itemId: string,
  orgId: string
): Promise<ModifierGroup[]> {
  try {
    // Try to get from cache first
    const cachedModifiers = dataCache.get<any[]>(orgId, "modifiers");
    
    if (cachedModifiers) {
      console.log("[ModifierCache] Using cached modifiers");
      
      // Get item-modifier associations from cache or API
      const itemModifiers = await getItemModifierAssociations(itemId, orgId);
      
      if (!itemModifiers || itemModifiers.length === 0) {
        console.log("[ModifierCache] No modifiers linked to item");
        return [];
      }
      
      // Build modifier groups for this item
      const groups = await buildModifierGroupsForItem(itemId, itemModifiers, orgId);
      return groups;
    }
    
    // Cache miss - fall back to API
    console.log("[ModifierCache] Cache miss, fetching from API");
    const response = await fetch(`/api/items/${itemId}/modifiers/full`);
    
    if (!response.ok) {
      console.error("[ModifierCache] API error:", response.status);
      return [];
    }
    
    return await response.json();
  } catch (error) {
    console.error("[ModifierCache] Error getting modifiers:", error);
    return [];
  }
}

/**
 * Get item-modifier associations
 */
async function getItemModifierAssociations(
  itemId: string,
  orgId: string
): Promise<ItemModifier[]> {
  try {
    // Check if we have item associations cached
    const cachedAssociations = dataCache.get<ItemModifier[]>(
      orgId,
      `item_modifiers_${itemId}`
    );
    
    if (cachedAssociations) {
      return cachedAssociations;
    }
    
    // Fetch from API
    const response = await fetch(`/api/items/${itemId}/modifiers`);
    if (!response.ok) return [];
    
    const associations = await response.json();
    
    // Cache for future use
    dataCache.set(orgId, `item_modifiers_${itemId}`, associations);
    
    return associations;
  } catch (error) {
    console.error("[ModifierCache] Error getting associations:", error);
    return [];
  }
}

/**
 * Build full modifier groups for an item using cached data
 */
async function buildModifierGroupsForItem(
  itemId: string,
  itemModifiers: ItemModifier[],
  orgId: string
): Promise<ModifierGroup[]> {
  try {
    // First try to get from IndexedDB (fastest)
    try {
      const { getByKey } = await import('@/lib/idb/db');
      const row: any = await getByKey('item_modifier_groups', itemId as any);
      if (row?.groups?.length) {
        console.log('[ModifierCache] Using IndexedDB cached groups');
        return row.groups
          .filter((g: any) => g && g.modifier_options?.length > 0)
          .map((g: any) => ({
            ...g,
            modifier_options: g.modifier_options.filter(
              (opt: any) => opt.is_active !== false
            ),
          }));
      }
    } catch (idbError) {
      console.log('[ModifierCache] IndexedDB miss, trying API');
    }

    // Fallback: Get from API and cache for next time
    const response = await fetch(`/api/items/${itemId}/modifiers/full`);
    
    if (!response.ok) {
      console.error("[ModifierCache] Failed to fetch full modifier data");
      return [];
    }
    
    const groups = await response.json();
    
    // Cache in IndexedDB for next time
    try {
      const { getDB } = await import('@/lib/idb/db');
      const db = await getDB();
      await db.put('item_modifier_groups', { item_id: itemId, groups, org_id: orgId });
      console.log('[ModifierCache] Cached groups in IndexedDB');
    } catch (cacheError) {
      console.error('[ModifierCache] Failed to cache in IndexedDB:', cacheError);
    }
    
    // Filter out inactive options
    return groups
      .filter((g: any) => g && g.modifier_options?.length > 0)
      .map((g: any) => ({
        ...g,
        modifier_options: g.modifier_options.filter(
          (opt: any) => opt.is_active !== false
        ),
      }));
  } catch (error) {
    console.error("[ModifierCache] Error building groups:", error);
    return [];
  }
}

/**
 * Invalidate modifier cache for an item
 */
export function invalidateItemModifiers(itemId: string, orgId: string): void {
  dataCache.clear(orgId, `item_modifiers_${itemId}`);
  console.log(`[ModifierCache] Invalidated cache for item ${itemId}`);
}

/**
 * Invalidate all modifier caches
 */
export function invalidateAllModifiers(orgId: string): void {
  dataCache.clear(orgId, "modifiers");
  console.log(`[ModifierCache] Invalidated all modifier cache`);
}
