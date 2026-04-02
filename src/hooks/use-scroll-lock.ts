import { useEffect, useRef } from 'react';

/**
 * Global scroll lock manager to prevent conflicts between multiple modals
 * Tracks the number of active scroll locks and only unlocks when all are released
 */
class ScrollLockManager {
  private lockCount = 0;
  private originalOverflow = '';
  private originalPointerEvents = '';

  lock() {
    if (this.lockCount === 0) {
      // Store original values only on first lock
      this.originalOverflow = document.body.style.overflow;
      
      // Apply lock - only prevent scrolling, NOT pointer events
      // Pointer events need to work for dialogs to close when clicking outside
      document.body.style.overflow = 'hidden';
      
      // Also lock html element for better compatibility
      const html = document.documentElement;
      html.style.overflow = 'hidden';
    }
    this.lockCount++;
  }

  unlock() {
    this.lockCount = Math.max(0, this.lockCount - 1);
    
    if (this.lockCount === 0) {
      // Restore original overflow value
      if (this.originalOverflow) {
        document.body.style.overflow = this.originalOverflow;
      } else {
        document.body.style.removeProperty('overflow');
      }
      
      // Also restore html element
      const html = document.documentElement;
      html.style.removeProperty('overflow');
    }
  }

  forceUnlock() {
    // Emergency unlock - resets everything
    this.lockCount = 0;
    document.body.style.removeProperty('overflow');
    document.documentElement.style.removeProperty('overflow');
  }

  getCount() {
    return this.lockCount;
  }
}

// Global instance
const scrollLockManager = new ScrollLockManager();

/**
 * Hook to safely manage scroll lock for modals
 * Automatically unlocks when component unmounts
 * Handles multiple modals without conflicts
 */
export function useScrollLock(shouldLock: boolean = true) {
  const isLockedRef = useRef(false);

  useEffect(() => {
    if (shouldLock && !isLockedRef.current) {
      scrollLockManager.lock();
      isLockedRef.current = true;
    } else if (!shouldLock && isLockedRef.current) {
      scrollLockManager.unlock();
      isLockedRef.current = false;
    }

    return () => {
      if (isLockedRef.current) {
        scrollLockManager.unlock();
        isLockedRef.current = false;
      }
    };
  }, [shouldLock]);
}

/**
 * Get the global scroll lock manager for manual control if needed
 */
export function getScrollLockManager() {
  return scrollLockManager;
}

/**
 * Force unlock all scroll locks (emergency use only)
 */
export function forceUnlockScroll() {
  scrollLockManager.forceUnlock();
}
