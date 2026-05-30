"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only register in production
    if (process.env.NODE_ENV !== "production") {
      console.log("[SW] Development mode - service worker registration skipped");
      return;
    }

    const registerServiceWorker = async () => {
      try {
        // Check if service workers are supported
        if (!("serviceWorker" in navigator)) {
          console.error("[SW] Service workers not supported");
          return;
        }

        console.log("[SW] Attempting to register service worker...");

        // Register the service worker
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        console.log("[SW] Service worker registered successfully:", registration);

        // Don't notify on mount - only notify when a NEW update is found via updatefound
        // This prevents false positives when a waiting worker from a previous session is still there

        // Listen for new service worker installing
        registration.addEventListener("updatefound", () => {
          console.log("[SW] Service worker update found");
          const newWorker = registration.installing;
          
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            console.log("[SW] New service worker state:", newWorker.state);
            
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New service worker is installed and waiting
              console.log("[SW] New service worker installed and waiting");
              notifyUpdateAvailable(newWorker);
            }
          });
        });

        // Check for updates periodically (every 5 minutes)
        setInterval(() => {
          console.log("[SW] Checking for updates...");
          registration.update();
        }, 5 * 60 * 1000);

        // Also check for updates when page becomes visible
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) {
            console.log("[SW] Page visible, checking for updates...");
            registration.update();
          }
        });
      } catch (error) {
        console.error("[SW] Service worker registration failed:", error);
      }
    };

    // Helper to notify about available updates
    const notifyUpdateAvailable = (worker: ServiceWorker) => {
      // Dispatch custom event that PWAUpdateNotifier can listen to
      window.dispatchEvent(
        new CustomEvent("swUpdateAvailable", {
          detail: { worker },
        })
      );
    };

    // Register immediately
    registerServiceWorker();
  }, []);

  return null;
}
