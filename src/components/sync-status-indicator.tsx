"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useOutbox } from "@/lib/hooks/use-outbox";
import { SyncManager } from "@/lib/services/sync-manager";

export function SyncStatusIndicator() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const { pending, failed, syncing, syncNow } = useOutbox();

  useEffect(() => {
    // Initial online status
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    // Update last sync time periodically
    const updateLastSync = async () => {
      try {
        if (typeof window === 'undefined') return;
        
        const sessionData = sessionStorage.getItem("pos_session");
        if (!sessionData) return;

        const session = JSON.parse(sessionData);
        if (!session?.org_id) return;
        
        const status = await SyncManager.getSyncStatus(session.org_id);
        
        // Find most recent sync
        let mostRecent = 0;
        for (const dataType in status) {
          const lastSync = status[dataType as keyof typeof status].lastSync;
          if (lastSync && lastSync > mostRecent) {
            mostRecent = lastSync;
          }
        }

        if (mostRecent > 0) {
          const minutes = Math.floor((Date.now() - mostRecent) / 60000);
          if (minutes < 1) {
            setLastSyncTime("Just now");
          } else if (minutes < 60) {
            setLastSyncTime(`${minutes}m ago`);
          } else {
            const hours = Math.floor(minutes / 60);
            setLastSyncTime(`${hours}h ago`);
          }
        }
      } catch (error) {
        console.error("[SyncStatus] Failed to get sync time:", error);
      }
    };

    updateLastSync();
    const interval = setInterval(updateLastSync, 30000); // Update every 30s

    return () => clearInterval(interval);
  }, []);

  const hasPendingItems = pending > 0 || failed > 0;

  // Determine circle color
  const getStatusColor = () => {
    if (!isOnline) return "bg-red-500";
    if (hasPendingItems) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="relative">
      {/* Minimal circle indicator */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="relative p-1 hover:opacity-80 transition-opacity"
        aria-label="Sync status"
      >
        {syncing ? (
          <RefreshCw className="h-3 w-3 text-white animate-spin" />
        ) : (
          <div className={`h-3 w-3 rounded-full ${getStatusColor()} ring-2 ring-white/20`} />
        )}
      </button>

      {/* Popup details */}
      {showDetails && (
        <>
          {/* Backdrop to close on click outside */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowDetails(false)}
          />
          
          {/* Popup */}
          <div className="absolute top-full right-0 mt-2 w-64 bg-[#3d3d3d] text-white rounded-lg shadow-xl p-4 z-50">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <span className={`text-sm ${isOnline ? "text-green-400" : "text-red-400"}`}>
                  {isOnline ? "Online" : "Offline"}
                </span>
              </div>

              {lastSyncTime && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Last sync</span>
                  <span className="text-sm">{lastSyncTime}</span>
                </div>
              )}

              {pending > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Pending</span>
                  <span className="text-sm text-yellow-400">{pending} items</span>
                </div>
              )}

              {failed > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Failed</span>
                  <span className="text-sm text-red-400">{failed} items</span>
                </div>
              )}

              {isOnline && hasPendingItems && (
                <button
                  onClick={async () => {
                    setSyncError(null);
                    try {
                      await syncNow();
                      console.log('[SyncStatus] Sync completed successfully');
                      // Update last sync time immediately
                      setLastSyncTime("Just now");
                    } catch (error: any) {
                      console.error('[SyncStatus] Sync failed:', error);
                      setSyncError(error?.message || 'Sync failed');
                    }
                  }}
                  disabled={syncing}
                  className="w-full mt-2 px-3 py-2 bg-penkey-orange hover:bg-penkey-orange/90 disabled:opacity-50 rounded text-sm font-medium transition-colors"
                >
                  {syncing ? "Syncing..." : "Sync Now"}
                </button>
              )}

              {failed > 0 && (
                <button
                  onClick={async () => {
                    setSyncError(null);
                    try {
                      const { OutboxSyncService } = await import('@/lib/services/outbox-sync');
                      const retried = await OutboxSyncService.retryFailedItems();
                      console.log(`[SyncStatus] Retrying ${retried} failed items`);
                      // Update last sync time immediately
                      setLastSyncTime("Just now");
                    } catch (error: any) {
                      console.error('[SyncStatus] Retry failed:', error);
                      setSyncError(error?.message || 'Retry failed');
                    }
                  }}
                  disabled={syncing}
                  className="w-full mt-2 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded text-sm font-medium transition-colors"
                >
                  Retry Failed ({failed})
                </button>
              )}

              {syncError && (
                <div className="mt-2 p-2 bg-red-900/20 border border-red-700 rounded text-xs text-red-400">
                  {syncError}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
