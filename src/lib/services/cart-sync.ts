/**
 * Cart Sync Service
 * Syncs cart state across multiple devices using Supabase
 */

import { createClient } from '@supabase/supabase-js';
import type { CartLine } from '@/lib/store/cart-store';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface ActiveCart {
  id: string;
  org_id: string;
  register_id: string | null;
  employee_id: string | null;
  lines: CartLine[];
  ticket_assignment: any;
  updated_at: string;
  last_activity_at: string;
}

export class CartSyncService {
  private static syncInterval: NodeJS.Timeout | null = null;
  private static currentCartId: string | null = null;
  private static lastSyncedAt: string | null = null;

  /**
   * Initialize cart sync for a register/employee
   * Loads existing cart or creates new one
   */
  static async initialize(
    orgId: string,
    registerId: string,
    employeeId: string
  ): Promise<{ lines: CartLine[]; ticketAssignment: any }> {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Try to find existing cart for this register AND employee (user-scoped)
      const { data: existingCart } = await supabase
        .from('active_carts')
        .select('*')
        .eq('org_id', orgId)
        .eq('register_id', registerId)
        .eq('employee_id', employeeId)
        .order('last_activity_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingCart) {
        console.log('[CartSync] Loaded existing cart:', existingCart.id);
        this.currentCartId = existingCart.id;
        this.lastSyncedAt = existingCart.updated_at;
        return {
          lines: existingCart.lines || [],
          ticketAssignment: existingCart.ticket_assignment,
        };
      }

      // Create new cart
      const { data: newCart, error } = await supabase
        .from('active_carts')
        .insert({
          org_id: orgId,
          register_id: registerId,
          employee_id: employeeId,
          lines: [],
        })
        .select()
        .single();

      if (error) throw error;

      console.log('[CartSync] Created new cart:', newCart.id);
      this.currentCartId = newCart.id;
      this.lastSyncedAt = newCart.updated_at;

      return { lines: [], ticketAssignment: null };
    } catch (error) {
      console.error('[CartSync] Initialize failed:', error);
      return { lines: [], ticketAssignment: null };
    }
  }

  /**
   * Save cart to database
   */
  static async saveCart(
    lines: CartLine[],
    ticketAssignment: any = null
  ): Promise<void> {
    if (!this.currentCartId) {
      console.warn('[CartSync] No cart ID, skipping save');
      return;
    }

    try {
      const supabase = createClient(supabaseUrl, supabaseKey);

      const now = new Date().toISOString();
      const { error } = await supabase
        .from('active_carts')
        .update({
          lines,
          ticket_assignment: ticketAssignment,
          updated_at: now,
          last_activity_at: now,
        })
        .eq('id', this.currentCartId);

      if (error) throw error;

      console.log('[CartSync] Cart saved successfully');
    } catch (error) {
      console.error('[CartSync] Save failed:', error);
    }
  }

  /**
   * Check for updates from other devices
   */
  static async checkForUpdates(): Promise<{
    hasUpdates: boolean;
    lines?: CartLine[];
    ticketAssignment?: any;
  }> {
    if (!this.currentCartId || !this.lastSyncedAt) {
      return { hasUpdates: false };
    }

    try {
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: cart } = await supabase
        .from('active_carts')
        .select('*')
        .eq('id', this.currentCartId)
        .single();

      if (!cart) {
        return { hasUpdates: false };
      }

      // Check if cart was updated since our last sync
      if (cart.updated_at > this.lastSyncedAt) {
        console.log('[CartSync] Updates detected from another device');
        this.lastSyncedAt = cart.updated_at;
        return {
          hasUpdates: true,
          lines: cart.lines || [],
          ticketAssignment: cart.ticket_assignment,
        };
      }

      return { hasUpdates: false };
    } catch (error) {
      console.error('[CartSync] Check for updates failed:', error);
      return { hasUpdates: false };
    }
  }

  /**
   * Start polling for updates
   */
  static startSync(
    onUpdate: (lines: CartLine[], ticketAssignment: any) => void,
    intervalMs: number = 3000 // Poll every 3 seconds
  ): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      const result = await this.checkForUpdates();
      if (result.hasUpdates && result.lines) {
        onUpdate(result.lines, result.ticketAssignment);
      }
    }, intervalMs);

    console.log('[CartSync] Started polling for updates');
  }

  /**
   * Stop polling
   */
  static stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[CartSync] Stopped polling');
    }
  }

  /**
   * Clear cart (after payment completion or when cart becomes empty)
   * Retries up to 3 times to ensure stale carts don't persist in the DB.
   */
  static async clearCart(): Promise<void> {
    if (!this.currentCartId) return;

    const cartId = this.currentCartId;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        await supabase
          .from('active_carts')
          .delete()
          .eq('id', cartId);

        console.log('[CartSync] Cart cleared');
        this.currentCartId = null;
        this.lastSyncedAt = null;
        return;
      } catch (error) {
        console.error(`[CartSync] Clear failed (attempt ${attempt}/${maxRetries}):`, error);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
      }
    }

    // All retries failed — still clear local references so next init creates a fresh cart
    console.warn('[CartSync] Could not clear cart from DB after retries — clearing local refs');
    this.currentCartId = null;
    this.lastSyncedAt = null;
  }
}
