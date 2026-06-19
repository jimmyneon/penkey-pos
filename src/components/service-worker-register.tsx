"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ServiceWorkerRegister() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only register in production
    if (process.env.NODE_ENV !== "production") {
      console.log("[SW] Development mode - service worker registration skipped");
      return;
    }

    // Only register on pages that need offline support
    // Vouchers, items, reports, settings, etc. don't need offline support
    const offlineRoutes = ['/sell', '/payment'];
    const needsOffline = offlineRoutes.some(route => pathname.startsWith(route));

    if (!needsOffline) {
      // Actively unregister any existing SW on non-offline pages.
      // This prevents the SW from intercepting requests and calling clients.claim()
      // which orphans in-flight fetch requests and causes the page to crash.
      // The SW will re-register automatically when the user navigates to /sell or /payment.
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        if (registrations.length > 0) {
          console.log("[SW] Unregistering SW on non-offline page:", pathname);
          registrations.forEach((reg) => reg.unregister());
        }
      });
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

        // Do NOT aggressively send SKIP_WAITING on registration startup.
        // A waiting SW will be activated when the user explicitly requests an update
        // (via PWAUpdateNotifier). Activating immediately kills in-flight requests.

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

        // Check for updates periodically (every 30 minutes, not 5)
        // Frequent update checks can trigger SW activation mid-request
        setInterval(() => {
          console.log("[SW] Checking for updates...");
          registration.update();
        }, 30 * 60 * 1000);
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
  }, [pathname]);

  return null;
}
