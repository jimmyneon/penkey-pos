/**
 * Outbox Sync Service
 * Handles offline-first writes with automatic background sync
 */

import { getDB } from "@/lib/idb/db";

export interface OutboxItem {
  id?: number;
  type: 'receipt' | 'inventory_adjustment' | 'item_update' | 'category_update';
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  data: any;
  created_at: number;
  synced_at?: number;
  error?: string;
  retry_count: number;
  org_id: string;
}

export class OutboxSyncService {
  private static syncInProgress = false;
  private static maxRetries = 10; // Increased from 3 to 10 attempts

  /**
   * Add item to outbox for later sync
   */
  static async addToOutbox(
    type: OutboxItem['type'],
    data: any,
    orgId: string,
    triggerSync: boolean = true
  ): Promise<number> {
    const db = await getDB();
    const item: OutboxItem = {
      type,
      status: 'pending',
      data,
      created_at: Date.now(),
      retry_count: 0,
      org_id: orgId,
    };

    const id = await db.add('outbox', item);
    console.log(`[Outbox] Added ${type} to outbox with id ${id}`);
    
    // Trigger sync if online and requested
    if (triggerSync && typeof navigator !== 'undefined' && navigator.onLine) {
      this.syncOutbox().catch(console.error);
    }

    return id as number;
  }

  /**
   * Get all pending outbox items
   */
  static async getPendingItems(): Promise<OutboxItem[]> {
    const db = await getDB();
    const tx = db.transaction('outbox', 'readonly');
    const index = tx.store.index('by_status');
    const items = await index.getAll('pending');
    return items as OutboxItem[];
  }

  /**
   * Get all failed outbox items
   */
  static async getFailedItems(): Promise<OutboxItem[]> {
    const db = await getDB();
    const tx = db.transaction('outbox', 'readonly');
    const index = tx.store.index('by_status');
    const items = await index.getAll('failed');
    return items as OutboxItem[];
  }

  /**
   * Retry all failed items by resetting their status to pending
   */
  static async retryFailedItems(): Promise<number> {
    const db = await getDB();
    const failed = await this.getFailedItems();
    
    console.log(`[Outbox] Retrying ${failed.length} failed items`);
    
    for (const item of failed) {
      await db.put('outbox', {
        ...item,
        status: 'pending',
        retry_count: 0, // Reset retry count
        error: undefined, // Clear error
      });
    }
    
    // Trigger sync
    if (failed.length > 0) {
      this.syncOutbox().catch(console.error);
    }
    
    return failed.length;
  }

  /**
   * Get outbox item count by status
   */
  static async getOutboxCount(): Promise<{ pending: number; failed: number; total: number }> {
    const db = await getDB();
    const all = await db.getAll('outbox');
    const pending = all.filter((item: any) => item.status === 'pending').length;
    const failed = all.filter((item: any) => item.status === 'failed').length;
    return { pending, failed, total: all.length };
  }

  /**
   * Sync all pending outbox items
   */
  static async syncOutbox(): Promise<void> {
    if (this.syncInProgress) {
      console.log('[Outbox] Sync already in progress, skipping');
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('[Outbox] Offline, skipping sync');
      return;
    }

    this.syncInProgress = true;
    console.log('[Outbox] Starting sync...');

    try {
      const pending = await this.getPendingItems();
      console.log(`[Outbox] Found ${pending.length} pending items`);

      for (const item of pending) {
        await this.syncItem(item);
      }

      console.log('[Outbox] Sync complete');
    } catch (error) {
      console.error('[Outbox] Sync error:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync a single outbox item
   */
  private static async syncItem(item: OutboxItem): Promise<void> {
    const db = await getDB();

    try {
      // Update status to syncing
      await db.put('outbox', { ...item, status: 'syncing' });

      // Sync based on type
      let success = false;
      switch (item.type) {
        case 'receipt':
          success = await this.syncReceipt(item.data);
          break;
        case 'inventory_adjustment':
          success = await this.syncInventoryAdjustment(item.data);
          break;
        case 'item_update':
          success = await this.syncItemUpdate(item.data);
          break;
        case 'category_update':
          success = await this.syncCategoryUpdate(item.data);
          break;
        default:
          console.error(`[Outbox] Unknown item type: ${item.type}`);
          success = false;
      }

      if (success) {
        // Mark as synced
        await db.put('outbox', {
          ...item,
          status: 'synced',
          synced_at: Date.now(),
        });
        console.log(`[Outbox] Successfully synced ${item.type} (id: ${item.id})`);
      } else {
        throw new Error('Sync failed');
      }
    } catch (error: any) {
      console.error(`[Outbox] Failed to sync ${item.type}:`, error);
      console.error(`[Outbox] Item data:`, JSON.stringify(item.data, null, 2));
      console.error(`[Outbox] Error details:`, {
        message: error.message,
        stack: error.stack,
        response: error.response,
      });

      // Increment retry count
      const newRetryCount = item.retry_count + 1;
      const status = newRetryCount >= this.maxRetries ? 'failed' : 'pending';

      await db.put('outbox', {
        ...item,
        status,
        retry_count: newRetryCount,
        error: `${error.message} (attempt ${newRetryCount}/${this.maxRetries})`,
      });
      
      console.log(`[Outbox] ${item.type} marked as ${status} (retry ${newRetryCount}/${this.maxRetries})`);
    }
  }

  /**
   * Get CSRF token from cookies
   */
  private static getCsrfToken(): string | null {
    if (typeof document === 'undefined') return null;
    
    const cookies = document.cookie.split(';').map(c => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith('csrf_token=')) {
        return cookie.substring('csrf_token='.length);
      }
    }
    return null;
  }

  /**
   * Sync receipt to API
   */
  private static async syncReceipt(data: any): Promise<boolean> {
    try {
      const csrfToken = this.getCsrfToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      
      // Add CSRF token if available
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }
      
      console.log('[Outbox] Syncing receipt:', data.id);
      const response = await fetch('/api/receipts/create', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        credentials: 'include', // Include session cookies
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to sync receipt: ${response.status}`);
      }

      const result = await response.json();
      console.log('[Outbox] Receipt synced successfully:', result.receipt_id);
      
      // Clean up temp receipt from IndexedDB after successful sync
      if (data.id && data.id.startsWith('temp_')) {
        try {
          const db = await getDB();
          await db.delete('receipts', data.id);
          console.log('[Outbox] Deleted temp receipt from IndexedDB:', data.id);
          
          // Also delete temp receipt lines
          const tx = db.transaction('receipt_lines', 'readwrite');
          const linesStore = tx.objectStore('receipt_lines');
          const linesIndex = linesStore.index('by_receipt');
          const lines = await linesIndex.getAll(data.id);
          
          for (const line of lines) {
            if (line.id) {
              await linesStore.delete(line.id);
            }
          }
          console.log('[Outbox] Deleted', lines.length, 'temp receipt lines from IndexedDB');
        } catch (cleanupError) {
          console.warn('[Outbox] Failed to clean up temp receipt:', cleanupError);
          // Don't fail the sync if cleanup fails
        }
      }
      
      return true;
    } catch (error) {
      console.error('[Outbox] Receipt sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync inventory adjustment to API
   */
  private static async syncInventoryAdjustment(data: any): Promise<boolean> {
    try {
      const csrfToken = this.getCsrfToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }
      
      console.log('[Outbox] Syncing inventory adjustment:', data);
      const response = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to sync inventory: ${response.status}`);
      }

      console.log('[Outbox] Inventory adjustment synced successfully');
      return true;
    } catch (error) {
      console.error('[Outbox] Inventory adjustment sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync item update to API
   */
  private static async syncItemUpdate(data: any): Promise<boolean> {
    try {
      const csrfToken = this.getCsrfToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }
      
      console.log('[Outbox] Syncing item update:', data.id);
      const response = await fetch(`/api/items/${data.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to sync item: ${response.status}`);
      }

      console.log('[Outbox] Item update synced successfully:', data.id);
      return true;
    } catch (error) {
      console.error('[Outbox] Item update sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync category update to API
   */
  private static async syncCategoryUpdate(data: any): Promise<boolean> {
    try {
      const csrfToken = this.getCsrfToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }
      
      console.log('[Outbox] Syncing category update:', data.id);
      const response = await fetch(`/api/categories/${data.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to sync category: ${response.status}`);
      }

      console.log('[Outbox] Category update synced successfully:', data.id);
      return true;
    } catch (error) {
      console.error('[Outbox] Category update sync failed:', error);
      throw error;
    }
  }

  /**
   * Clear all synced items from outbox
   */
  static async clearSynced(): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('outbox', 'readwrite');
    const index = tx.store.index('by_status');
    const synced = await index.getAll('synced');

    for (const item of synced) {
      await tx.store.delete((item as any).id);
    }

    await tx.done;
    console.log(`[Outbox] Cleared ${synced.length} synced items`);
  }

  /**
   * Retry failed items
   */
  static async retryFailed(): Promise<void> {
    const db = await getDB();
    const failed = await this.getFailedItems();

    for (const item of failed) {
      await db.put('outbox', {
        ...item,
        status: 'pending',
        retry_count: 0,
        error: undefined,
      });
    }

    console.log(`[Outbox] Reset ${failed.length} failed items to pending`);
    
    // Trigger sync
    await this.syncOutbox();
  }

  /**
   * Setup automatic sync on network reconnection
   */
  static setupAutoSync(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', async () => {
      console.log('[Outbox] Network reconnected - syncing pending and retrying failed items...');
      // Reset any failed items back to pending so they get another chance
      try {
        const failed = await this.getFailedItems();
        if (failed.length > 0) {
          console.log(`[Outbox] Resetting ${failed.length} failed items to pending on reconnect`);
          await this.retryFailed();
        } else {
          await this.syncOutbox();
        }
      } catch (err) {
        console.error('[Outbox] Reconnect sync error:', err);
      }
    });
  }
}
