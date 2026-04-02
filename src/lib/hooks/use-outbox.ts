/**
 * Hook to monitor outbox status and trigger syncs
 */

import { useState, useEffect } from "react";
import { OutboxSyncService } from "@/lib/services/outbox-sync";

export function useOutbox() {
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Setup auto-sync on mount
    OutboxSyncService.setupAutoSync();

    // Initial count
    updateCounts();

    // Poll for changes every 10 seconds
    const interval = setInterval(updateCounts, 10000);

    return () => clearInterval(interval);
  }, []);

  const updateCounts = async () => {
    try {
      const counts = await OutboxSyncService.getOutboxCount();
      setPending(counts.pending);
      setFailed(counts.failed);
    } catch (error) {
      console.error("[useOutbox] Failed to get counts:", error);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      console.log("[useOutbox] Starting sync...");
      await OutboxSyncService.syncOutbox();
      console.log("[useOutbox] Sync completed, updating counts...");
      await updateCounts();
      console.log("[useOutbox] Counts updated");
    } catch (error) {
      console.error("[useOutbox] Sync failed:", error);
      throw error;
    } finally {
      setSyncing(false);
    }
  };

  const retryFailed = async () => {
    setSyncing(true);
    try {
      await OutboxSyncService.retryFailed();
      await updateCounts();
    } catch (error) {
      console.error("[useOutbox] Retry failed:", error);
    } finally {
      setSyncing(false);
    }
  };

  const clearSynced = async () => {
    try {
      await OutboxSyncService.clearSynced();
      await updateCounts();
    } catch (error) {
      console.error("[useOutbox] Clear synced failed:", error);
    }
  };

  return {
    pending,
    failed,
    syncing,
    syncNow,
    retryFailed,
    clearSynced,
    refresh: updateCounts,
  };
}
