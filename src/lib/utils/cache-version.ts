/**
 * Cache Version Management
 * 
 * When the data structure changes (e.g., adding sort_order fields),
 * increment this version to force cache invalidation.
 */

export const CACHE_VERSION = 2; // Increment when data structure changes

/**
 * Check if cache needs to be cleared due to version mismatch
 */
export async function checkCacheVersion(): Promise<boolean> {
  try {
    const storedVersion = localStorage.getItem('cache_version');
    const currentVersion = CACHE_VERSION.toString();
    
    if (storedVersion !== currentVersion) {
      console.log(`[CacheVersion] Version mismatch: stored=${storedVersion}, current=${currentVersion}`);
      return false; // Needs clearing
    }
    
    return true; // Cache is current
  } catch (error) {
    console.error('[CacheVersion] Error checking version:', error);
    return false;
  }
}

/**
 * Clear all caches and update version
 */
export async function clearAllCaches(): Promise<void> {
  try {
    console.log('[CacheVersion] Clearing all caches...');
    
    // Clear IndexedDB stores that contain modifier data
    const { getDB } = await import('@/lib/idb/db');
    const db = await getDB();
    
    const storesToClear = [
      'item_modifier_groups',  // Item-specific modifier cache
      'modifier_groups',       // Modifier groups
      'modifiers',            // Individual modifiers
      'item_modifiers',       // Item-modifier associations
      'meta',                 // Timestamps
    ];
    
    for (const storeName of storesToClear) {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        await tx.objectStore(storeName).clear();
        await tx.done;
        console.log(`[CacheVersion] Cleared ${storeName}`);
      } catch (err) {
        console.warn(`[CacheVersion] Failed to clear ${storeName}:`, err);
      }
    }
    
    // Clear RAM cache
    const { modifierRAMCache } = await import('@/lib/services/modifier-ram-cache');
    modifierRAMCache.clear();
    console.log('[CacheVersion] Cleared RAM cache');
    
    // Update version
    localStorage.setItem('cache_version', CACHE_VERSION.toString());
    console.log(`[CacheVersion] Updated to version ${CACHE_VERSION}`);
    
  } catch (error) {
    console.error('[CacheVersion] Error clearing caches:', error);
  }
}

/**
 * Initialize cache version check on app load
 */
export async function initializeCacheVersion(): Promise<void> {
  const isCurrentVersion = await checkCacheVersion();
  
  if (!isCurrentVersion) {
    console.log('[CacheVersion] Cache version outdated, clearing...');
    await clearAllCaches();
  } else {
    console.log('[CacheVersion] Cache version is current');
  }
}
