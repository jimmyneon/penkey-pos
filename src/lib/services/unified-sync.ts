/**
 * Unified Bidirectional Sync Service
 * Coordinates sync between IndexedDB and Supabase in both directions
 * - Pushes local changes (outbox) to Supabase
 * - Pulls fresh data from Supabase to IndexedDB
 */

import { OutboxSyncService } from "./outbox-sync";
import { prefetchOrgData } from "@/lib/offline/prefetch";
import { SyncManager } from "./sync-manager";
import { dataCache } from "./data-cache";

export class UnifiedSyncService {
  private static syncInProgress = false;

  /**
   * Perform full bidirectional sync
   * 1. Push local changes to Supabase (outbox)
   * 2. Pull fresh data from Supabase to IndexedDB
   * 3. Clear in-memory cache to force refresh
   */
  static async syncAll(orgId: string, registerId?: string): Promise<{
    pushed: number;
    pushedTypes: { [key: string]: number };
    pulled: boolean;
    pulledTypes: { [key: string]: number };
    error?: string;
  }> {
    if (this.syncInProgress) {
      console.log('[UnifiedSync] Sync already in progress, skipping');
      return { pushed: 0, pushedTypes: {}, pulled: false, pulledTypes: {}, error: 'Sync already in progress' };
    }

    if (!SyncManager.isOnline()) {
      console.log('[UnifiedSync] Offline, skipping sync');
      return { pushed: 0, pushedTypes: {}, pulled: false, pulledTypes: {}, error: 'Offline' };
    }

    this.syncInProgress = true;
    console.log('[UnifiedSync] Starting full bidirectional sync...');

    try {
      // Step 1: Push local changes to Supabase
      console.log('[UnifiedSync] Step 1: Pushing local changes to Supabase...');
      const outboxCount = await OutboxSyncService.getOutboxCount();
      const pendingCount = outboxCount.pending + outboxCount.failed;
      const pushedTypes: { [key: string]: number } = {};
      
      if (pendingCount > 0) {
        console.log(`[UnifiedSync] Found ${pendingCount} pending/failed items in outbox`);
        
        // Get pending items to count by type
        const pendingItems = await OutboxSyncService.getPendingItems();
        const failedItems = await OutboxSyncService.getFailedItems();
        const allItems = [...pendingItems, ...failedItems];
        
        allItems.forEach(item => {
          pushedTypes[item.type] = (pushedTypes[item.type] || 0) + 1;
        });
        
        // Reset failed items to pending for retry
        if (outboxCount.failed > 0) {
          await OutboxSyncService.retryFailedItems();
        }
        await OutboxSyncService.syncOutbox();
      } else {
        console.log('[UnifiedSync] No pending items to push');
      }

      // Step 2: Pull fresh data from Supabase to IndexedDB
      console.log('[UnifiedSync] Step 2: Pulling fresh data from Supabase...');
      
      // Clear sync timestamps to force fresh fetch
      await SyncManager.clearSyncTimestamp(orgId, 'ITEMS');
      await SyncManager.clearSyncTimestamp(orgId, 'CATEGORIES');
      await SyncManager.clearSyncTimestamp(orgId, 'MODIFIERS');
      await SyncManager.clearSyncTimestamp(orgId, 'TAXES');
      await SyncManager.clearSyncTimestamp(orgId, 'REGISTER_SETTINGS');
      await SyncManager.clearSyncTimestamp(orgId, 'RECEIPTS');
      await SyncManager.clearSyncTimestamp(orgId, 'REPORTS');

      // Fetch and cache all data
      await prefetchOrgData(orgId, registerId);

      // Get pulled data counts from IndexedDB
      const { getAll } = await import('@/lib/idb/db');
      const pulledTypes: { [key: string]: number } = {};
      
      try {
        pulledTypes.items = (await getAll('items')).filter((i: any) => i.org_id === orgId).length;
        pulledTypes.categories = (await getAll('categories')).filter((c: any) => c.org_id === orgId).length;
        pulledTypes.modifiers = (await getAll('modifiers')).filter((m: any) => m.org_id === orgId).length;
        pulledTypes.taxes = (await getAll('taxes')).filter((t: any) => t.org_id === orgId).length;
        pulledTypes.receipts = (await getAll('receipts')).filter((r: any) => r.org_id === orgId).length;
      } catch (err) {
        console.error('[UnifiedSync] Error counting pulled data:', err);
      }

      // Step 3: Clear in-memory cache to force refresh
      console.log('[UnifiedSync] Step 3: Clearing in-memory cache...');
      dataCache.clearOrg(orgId);

      console.log('[UnifiedSync] ✅ Full bidirectional sync complete');
      return { pushed: pendingCount, pushedTypes, pulled: true, pulledTypes };
    } catch (error: any) {
      console.error('[UnifiedSync] Sync failed:', error);
      return { pushed: 0, pushedTypes: {}, pulled: false, pulledTypes: {}, error: error.message };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Quick sync - only push local changes, don't pull fresh data
   * Useful when you know remote data hasn't changed
   */
  static async syncPushOnly(orgId: string): Promise<{
    pushed: number;
    error?: string;
  }> {
    if (!SyncManager.isOnline()) {
      console.log('[UnifiedSync] Offline, skipping push sync');
      return { pushed: 0, error: 'Offline' };
    }

    console.log('[UnifiedSync] Starting push-only sync...');
    try {
      const outboxCount = await OutboxSyncService.getOutboxCount();
      const pendingCount = outboxCount.pending + outboxCount.failed;
      
      if (pendingCount > 0) {
        console.log(`[UnifiedSync] Found ${pendingCount} pending/failed items`);
        if (outboxCount.failed > 0) {
          await OutboxSyncService.retryFailedItems();
        }
        await OutboxSyncService.syncOutbox();
      }

      console.log('[UnifiedSync] ✅ Push-only sync complete');
      return { pushed: pendingCount };
    } catch (error: any) {
      console.error('[UnifiedSync] Push sync failed:', error);
      return { pushed: 0, error: error.message };
    }
  }

  /**
   * Quick sync - only pull fresh data, don't push local changes
   * Useful when you know local changes have already been synced
   */
  static async syncPullOnly(orgId: string, registerId?: string): Promise<{
    pulled: boolean;
    error?: string;
  }> {
    if (!SyncManager.isOnline()) {
      console.log('[UnifiedSync] Offline, skipping pull sync');
      return { pulled: false, error: 'Offline' };
    }

    console.log('[UnifiedSync] Starting pull-only sync...');
    try {
      // Clear sync timestamps to force fresh fetch
      await SyncManager.clearSyncTimestamp(orgId, 'ITEMS');
      await SyncManager.clearSyncTimestamp(orgId, 'CATEGORIES');
      await SyncManager.clearSyncTimestamp(orgId, 'MODIFIERS');
      await SyncManager.clearSyncTimestamp(orgId, 'TAXES');
      await SyncManager.clearSyncTimestamp(orgId, 'REGISTER_SETTINGS');
      await SyncManager.clearSyncTimestamp(orgId, 'RECEIPTS');
      await SyncManager.clearSyncTimestamp(orgId, 'REPORTS');

      await prefetchOrgData(orgId, registerId);
      dataCache.clearOrg(orgId);

      console.log('[UnifiedSync] ✅ Pull-only sync complete');
      return { pulled: true };
    } catch (error: any) {
      console.error('[UnifiedSync] Pull sync failed:', error);
      return { pulled: false, error: error.message };
    }
  }

  /**
   * Check if sync is currently in progress
   */
  static isSyncing(): boolean {
    return this.syncInProgress;
  }
}
