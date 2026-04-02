"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

export function PWAUpdateNotifier() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let unsubscribe: (() => void) | undefined;

    navigator.serviceWorker.ready
      .then((reg) => {
        setRegistration(reg);

        // Check for updates every hour
        const interval = setInterval(() => {
          reg.update().catch(() => {
            // Silently fail if update check fails
          });
        }, 60 * 60 * 1000);

        // Listen for new service worker waiting
        const handleControllerChange = () => {
          window.location.reload();
        };

        navigator.serviceWorker.addEventListener(
          "controllerchange",
          handleControllerChange
        );

        // Check if there's a waiting service worker
        if (reg.waiting) {
          setShowUpdate(true);
        }

        // Listen for updates
        const handleMessage = (event: Event) => {
          const messageEvent = event as MessageEvent;
          if (messageEvent.data && messageEvent.data.type === "UPDATE_AVAILABLE") {
            setShowUpdate(true);
          }
        };

        navigator.serviceWorker.addEventListener("message", handleMessage as EventListener);

        unsubscribe = () => {
          clearInterval(interval);
          navigator.serviceWorker.removeEventListener(
            "controllerchange",
            handleControllerChange
          );
          navigator.serviceWorker.removeEventListener("message", handleMessage as EventListener);
        };
      })
      .catch(() => {
        // Service worker not available
      });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      setShowUpdate(false);
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-5">
      <div className="bg-blue-500 text-white rounded-lg shadow-2xl px-4 py-3 flex items-center gap-3 max-w-md">
        <RefreshCw className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Update Available</p>
          <p className="text-xs opacity-90">A new version is ready to install</p>
        </div>
        <button
          onClick={handleUpdate}
          className="px-3 py-1.5 bg-white text-blue-500 text-xs font-medium rounded-md hover:bg-blue-50 transition-colors flex-shrink-0"
        >
          Update
        </button>
        <button
          onClick={handleDismiss}
          className="text-white/80 hover:text-white transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
