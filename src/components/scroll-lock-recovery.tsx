'use client';

/**
 * Silent scroll lock recovery component
 * Provides no UI - just ensures scroll lock system is loaded
 * The scroll lock/unlock happens automatically via useScrollLock hook
 */
export function ScrollLockRecovery() {
  // This component is intentionally minimal - it just needs to exist
  // so the scroll lock system is initialized globally
  return null;
}
