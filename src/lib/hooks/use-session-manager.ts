import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const BACKGROUND_LOCK_THRESHOLD = 5 * 60 * 1000; // 5 minutes background = re-lock

export function useSessionManager(onLock?: () => void) {
  const router = useRouter();
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastVisibilityTimeRef = useRef<number>(Date.now());
  const isHiddenRef = useRef(false);
  // Keep latest onLock ref so timer callbacks always use current value
  const onLockRef = useRef(onLock);
  useEffect(() => { onLockRef.current = onLock; }, [onLock]);

  const triggerLock = useCallback(() => {
    console.log("[SessionManager] Triggering lock");
    sessionStorage.removeItem("pos_session");
    if (onLockRef.current) {
      onLockRef.current();
    } else {
      router.replace("/lock");
    }
  }, [router]);

  // Check if session is valid
  const checkSession = useCallback(() => {
    const sessionData = sessionStorage.getItem("pos_session");
    if (!sessionData) {
      console.log("[SessionManager] No session found, locking");
      if (onLockRef.current) {
        onLockRef.current();
      } else {
        router.replace("/lock");
      }
      return false;
    }
    
    try {
      JSON.parse(sessionData);
      return true;
    } catch (err) {
      console.error("[SessionManager] Invalid session data, locking");
      sessionStorage.removeItem("pos_session");
      if (onLockRef.current) {
        onLockRef.current();
      } else {
        router.replace("/lock");
      }
      return false;
    }
  }, [router]);

  // Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    inactivityTimerRef.current = setTimeout(() => {
      console.log("[SessionManager] Inactivity timeout, locking");
      triggerLock();
    }, INACTIVITY_TIMEOUT);
  }, [triggerLock]);

  // Handle user activity
  const handleActivity = useCallback(() => {
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  // Handle page visibility change
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      isHiddenRef.current = true;
      lastVisibilityTimeRef.current = Date.now();
      console.log("[SessionManager] Page hidden");
    } else {
      const hiddenDuration = Date.now() - lastVisibilityTimeRef.current;
      isHiddenRef.current = false;
      console.log("[SessionManager] Page visible again, hidden for:", hiddenDuration, "ms");

      if (hiddenDuration > BACKGROUND_LOCK_THRESHOLD) {
        console.log("[SessionManager] Background too long, locking");
        triggerLock();
      } else {
        resetInactivityTimer();
      }
    }
  }, [triggerLock, resetInactivityTimer]);

  useEffect(() => {
    // Check session on mount
    if (!checkSession()) {
      return;
    }

    // Set up inactivity timer
    resetInactivityTimer();

    // Set up activity listeners
    const activityEvents = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];

    activityEvents.forEach((event) => {
      document.addEventListener(event, handleActivity);
    });

    // Set up visibility change listener
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      activityEvents.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkSession, resetInactivityTimer, handleActivity, handleVisibilityChange]);

  return { checkSession };
}
