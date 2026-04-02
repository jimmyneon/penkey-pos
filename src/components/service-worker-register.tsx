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

        // Listen for updates
        registration.addEventListener("updatefound", () => {
          console.log("[SW] Service worker update found");
        });

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute
      } catch (error) {
        console.error("[SW] Service worker registration failed:", error);
      }
    };

    // Register immediately
    registerServiceWorker();
  }, []);

  return null;
}
