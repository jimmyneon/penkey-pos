/**
 * PIN Cache Service
 * Caches employee PIN hashes locally for fast verification
 * Only used after user is authenticated via email/password
 * 
 * ✅ SECURITY: PIN hashes are encrypted before storing in IndexedDB
 */

import { getAll, putMany, setMeta, getMeta } from "@/lib/idb/db";
import { encryptData, decryptData } from "@/lib/utils/encryption";

interface CachedPin {
  member_id: string;
  pin_hash: string; // Encrypted
  org_id: string;
  employee_name: string;
  role: string;
  cached_at: number;
  encrypted: boolean; // Flag to indicate this is encrypted
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch and cache all PIN hashes for the organization
 */
export async function cachePinHashes(orgId: string): Promise<void> {
  try {
    console.log('[PinCache] Fetching PIN hashes for org:', orgId);
    
    const response = await fetch(`/api/auth/pin/cache?org_id=${orgId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch PIN hashes');
    }
    
    const pins: CachedPin[] = await response.json();
    
    // ✅ SECURITY: Encrypt PIN hashes before storing
    const encryptedPins = await Promise.all(
      pins.map(async (pin) => ({
        ...pin,
        pin_hash: await encryptData(pin.pin_hash),
        encrypted: true,
      }))
    );
    
    // Store encrypted data in IndexedDB
    await putMany('cached_pins', encryptedPins);
    await setMeta(`pins_cached_${orgId}`, Date.now());
    
    console.log(`[PinCache] Cached and encrypted ${encryptedPins.length} PIN hashes`);
  } catch (error) {
    console.error('[PinCache] Failed to cache PINs:', error);
    throw error;
  }
}

/**
 * Check if PIN cache is stale
 */
export async function isPinCacheStale(orgId: string): Promise<boolean> {
  const lastCached = await getMeta<number>(`pins_cached_${orgId}`);
  
  if (!lastCached) {
    return true; // No cache
  }
  
  const age = Date.now() - lastCached;
  return age > CACHE_TTL;
}

/**
 * Verify PIN using cached hashes (calls lightweight API)
 * Returns session data if valid, null if invalid
 */
export async function verifyPinLocally(
  pin: string,
  orgId: string
): Promise<any | null> {
  try {
    // Check if we have cached PINs
    const cachedPins = (await getAll('cached_pins')) as CachedPin[];
    const orgPins = cachedPins.filter(p => p.org_id === orgId);
    
    if (orgPins.length === 0) {
      console.log('[PinCache] No cached PINs, falling back to full API');
      return null;
    }
    
    // ✅ SECURITY: Decrypt PIN hashes before sending to API
    const decryptedPins = await Promise.all(
      orgPins.map(async (pin) => ({
        ...pin,
        pin_hash: pin.encrypted ? await decryptData(pin.pin_hash) : pin.pin_hash,
      }))
    );
    
    // Use lightweight verification endpoint that only checks cached hashes
    // This is much faster than the full API (no database queries)
    const response = await fetch('/api/auth/pin/verify-cached', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        pin, 
        org_id: orgId,
        cached_pins: decryptedPins, // Send decrypted hashes for verification
      }),
    });
    
    if (!response.ok) {
      return null; // Invalid PIN
    }
    
    const result = await response.json();
    console.log('[PinCache] ✅ PIN verified using cached hashes (fast!)');
    
    return result;
  } catch (error) {
    console.error('[PinCache] Cached verification failed:', error);
    return null;
  }
}

/**
 * Clear PIN cache (e.g., on logout)
 */
export async function clearPinCache(orgId: string): Promise<void> {
  try {
    const cachedPins = (await getAll('cached_pins')) as CachedPin[];
    const otherOrgPins = cachedPins.filter(p => p.org_id !== orgId);
    
    // Keep other orgs, remove this org
    await putMany('cached_pins', otherOrgPins);
    await setMeta(`pins_cached_${orgId}`, null);
    
    console.log('[PinCache] Cleared PIN cache for org:', orgId);
  } catch (error) {
    console.error('[PinCache] Failed to clear cache:', error);
  }
}
