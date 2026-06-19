"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";

export function PWAUpdateNotifier() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  // Tracks whether the user explicitly clicked "Update"
  // Only reload on controllerchange if this is true to prevent unexpected snaps
  const updateRequestedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let unsubscribe: (() => void) | undefined;

    // Listen for the custom update event from service-worker-register
    const handleUpdateAvailable = (event: Event) => {
      const customEvent = event as CustomEvent<{ worker: ServiceWorker }>;
      console.log("[PWA Update] Update available event received");
      setWaitingWorker(customEvent.detail.worker);
      setShowUpdate(true);
    };

    window.addEventListener("swUpdateAvailable", handleUpdateAvailable);

    navigator.serviceWorker.ready
      .then((reg) => {
        // Listen for controller change (when new SW takes over)
        // ONLY reload if the user explicitly clicked Update — not on any random controller change
        // (e.g. SW first claiming an uncontrolled page also fires controllerchange)
        const handleControllerChange = () => {
          if (updateRequestedRef.current) {
            console.log("[PWA Update] Controller changed after user update request, reloading page");
            window.location.reload();
          } else {
            console.log("[PWA Update] Controller changed (not user-requested, skipping reload)");
          }
        };

        navigator.serviceWorker.addEventListener(
          "controllerchange",
          handleControllerChange
        );

        // Don't show update prompt on mount - only when a NEW update is detected
        // This prevents false positives when a waiting worker from a previous session is still there

        unsubscribe = () => {
          window.removeEventListener("swUpdateAvailable", handleUpdateAvailable);
          navigator.serviceWorker.removeEventListener(
            "controllerchange",
            handleControllerChange
          );
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
    if (waitingWorker) {
      console.log("[PWA Update] Sending SKIP_WAITING message to service worker");
      updateRequestedRef.current = true;
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
      setShowUpdate(false);
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-5">
      <div className="bg-[#3d3d3d] text-white rounded-lg shadow-2xl px-4 py-3 flex items-center gap-3 max-w-md border border-orange-500/30">
        <RefreshCw className="w-5 h-5 flex-shrink-0 text-orange-400" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Update Available</p>
          <p className="text-xs text-gray-400">A new version is ready to install</p>
        </div>
        <button
          onClick={handleUpdate}
          className="px-3 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-md hover:bg-orange-600 transition-colors flex-shrink-0"
        >
          Update
        </button>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
