import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

export function useSessionManager() {
  const router = useRouter();
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastVisibilityTimeRef = useRef<number>(Date.now());
  const isHiddenRef = useRef(false);

  // Check if session is valid
  const checkSession = useCallback(() => {
    const sessionData = sessionStorage.getItem("pos_session");
    if (!sessionData) {
      console.log("[SessionManager] No session found, redirecting to lock");
      router.replace("/lock");
      return false;
    }
    
    try {
      const session = JSON.parse(sessionData);
      // Check if session is too old (optional: add timestamp check)
      return true;
    } catch (err) {
      console.error("[SessionManager] Invalid session data, redirecting to lock");
      sessionStorage.removeItem("pos_session");
      router.replace("/lock");
      return false;
    }
  }, [router]);

  // Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    inactivityTimerRef.current = setTimeout(() => {
      console.log("[SessionManager] Inactivity timeout, redirecting to lock");
      sessionStorage.removeItem("pos_session");
      router.replace("/lock");
    }, INACTIVITY_TIMEOUT);
  }, [router]);

  // Handle user activity
  const handleActivity = useCallback(() => {
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  // Handle page visibility change
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      // Page is being hidden (phone locked, tab switched, etc.)
      isHiddenRef.current = true;
      lastVisibilityTimeRef.current = Date.now();
      console.log("[SessionManager] Page hidden");
    } else {
      // Page is becoming visible again
      const hiddenDuration = Date.now() - lastVisibilityTimeRef.current;
      isHiddenRef.current = false;
      console.log("[SessionManager] Page visible again, hidden for:", hiddenDuration, "ms");

      // If page was hidden for more than 30 seconds, require PIN re-entry
      if (hiddenDuration > 30000) {
        console.log("[SessionManager] Page hidden for too long, requiring PIN");
        sessionStorage.removeItem("pos_session");
        router.replace("/lock");
      } else {
        // Otherwise, just reset the inactivity timer
        resetInactivityTimer();
      }
    }
  }, [router, resetInactivityTimer]);

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
