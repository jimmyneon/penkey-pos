/**
 * Tickets Service
 * Manages saved/parked tickets with database storage and realtime sync
 */

import { createSupabaseClient } from "@/lib/database";

export interface TicketLine {
  id: string;
  item_id: string;
  variant_id?: string;
  name: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  modifiers?: any;
  notes?: string;
  sort_order: number;
}

export interface Ticket {
  id: string;
  org_id: string;
  store_id: string;
  register_id: string;
  member_id: string;
  ticket_number: number;
  status: "open" | "parked";
  dining_option: "eat-in" | "takeaway";
  customer_name?: string;
  table_number?: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  tip_total: number;
  total: number;
  lines: TicketLine[];
  created_at: string;
  updated_at: string;
}

const CACHE_KEY = "pos_tickets_cache";
const CACHE_DURATION = 30 * 1000; // 30 seconds

export class TicketsService {
  private supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  private cache: { tickets: Ticket[]; timestamp: number } | null = null;

  /**
   * Get all parked tickets for a register
   */
  async getTickets(registerId: string): Promise<Ticket[]> {
    // Check cache first
    if (this.cache && Date.now() - this.cache.timestamp < CACHE_DURATION) {
      return this.cache.tickets;
    }

    try {
      // Get tickets with their lines
      const { data: tickets, error: ticketsError } = await this.supabase
        .from("tickets")
        .select("*")
        .eq("register_id", registerId)
        .eq("status", "parked")
        .order("created_at", { ascending: false });

      if (ticketsError) throw ticketsError;

      if (!tickets || tickets.length === 0) {
        this.cache = { tickets: [], timestamp: Date.now() };
        return [];
      }

      // Get all ticket lines for these tickets
      const ticketIds = tickets.map((t: any) => t.id);
      const { data: lines, error: linesError } = await this.supabase
        .from("ticket_lines")
        .select("*")
        .in("ticket_id", ticketIds)
        .eq("voided", false)
        .order("sort_order", { ascending: true });

      if (linesError) throw linesError;

      // Combine tickets with their lines
      const ticketsWithLines: Ticket[] = tickets.map((ticket: any) => ({
        ...ticket,
        lines: lines?.filter((line: any) => line.ticket_id === ticket.id) || [],
      }));

      // Update cache
      this.cache = { tickets: ticketsWithLines, timestamp: Date.now() };

      // Also store in localStorage as backup
      localStorage.setItem(CACHE_KEY, JSON.stringify(ticketsWithLines));

      return ticketsWithLines;
    } catch (err) {
      console.error("[Tickets] Error fetching tickets:", err);

      // Fallback to localStorage
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          return [];
        }
      }

      return [];
    }
  }

  /**
   * Save a new ticket (park it)
   */
  async saveTicket(
    ticket: Omit<Ticket, "id" | "created_at" | "updated_at">
  ): Promise<Ticket> {
    try {
      const { lines, ...ticketData } = ticket;

      // Insert ticket
      const { data: newTicket, error: ticketError } = await this.supabase
        .from("tickets")
        .insert({
          ...ticketData,
          status: "parked",
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Insert ticket lines
      if (lines && lines.length > 0) {
        const linesData = lines.map((line, index) => ({
          ticket_id: newTicket.id,
          item_id: line.item_id,
          variant_id: line.variant_id,
          name: line.name,
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_amount: line.discount_amount,
          tax_rate: line.tax_rate,
          tax_amount: line.tax_amount,
          total: line.total,
          modifiers: line.modifiers,
          notes: line.notes,
          sort_order: index,
        }));

        const { error: linesError } = await this.supabase
          .from("ticket_lines")
          .insert(linesData);

        if (linesError) throw linesError;
      }

      // Clear cache
      this.cache = null;

      console.log("[Tickets] Ticket saved:", newTicket.id);

      return {
        ...newTicket,
        lines: lines || [],
      };
    } catch (err) {
      console.error("[Tickets] Error saving ticket:", err);
      throw err;
    }
  }

  /**
   * Update an existing ticket
   */
  async updateTicket(ticketId: string, updates: Partial<Ticket>): Promise<void> {
    try {
      const { lines, ...ticketUpdates } = updates;

      // Update ticket
      const { error: ticketError } = await this.supabase
        .from("tickets")
        .update(ticketUpdates)
        .eq("id", ticketId);

      if (ticketError) throw ticketError;

      // If lines are provided, update them
      if (lines) {
        // Delete existing lines
        await this.supabase.from("ticket_lines").delete().eq("ticket_id", ticketId);

        // Insert new lines
        if (lines.length > 0) {
          const linesData = lines.map((line, index) => ({
            ticket_id: ticketId,
            item_id: line.item_id,
            variant_id: line.variant_id,
            name: line.name,
            quantity: line.quantity,
            unit_price: line.unit_price,
            discount_amount: line.discount_amount,
            tax_rate: line.tax_rate,
            tax_amount: line.tax_amount,
            total: line.total,
            modifiers: line.modifiers,
            notes: line.notes,
            sort_order: index,
          }));

          const { error: linesError } = await this.supabase
            .from("ticket_lines")
            .insert(linesData);

          if (linesError) throw linesError;
        }
      }

      // Clear cache
      this.cache = null;

      console.log("[Tickets] Ticket updated:", ticketId);
    } catch (err) {
      console.error("[Tickets] Error updating ticket:", err);
      throw err;
    }
  }

  /**
   * Delete a ticket
   */
  async deleteTicket(ticketId: string): Promise<void> {
    try {
      // Delete ticket (lines will cascade)
      const { error } = await this.supabase
        .from("tickets")
        .delete()
        .eq("id", ticketId);

      if (error) throw error;

      // Clear cache
      this.cache = null;

      console.log("[Tickets] Ticket deleted:", ticketId);
    } catch (err) {
      console.error("[Tickets] Error deleting ticket:", err);
      throw err;
    }
  }

  /**
   * Subscribe to ticket changes (realtime)
   */
  subscribe(
    registerId: string,
    callback: (tickets: Ticket[]) => void
  ): () => void {
    const channel = this.supabase
      .channel(`tickets:${registerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
          filter: `register_id=eq.${registerId}`,
        },
        async (payload: any) => {
          console.log("[Tickets] Ticket changed:", payload);
          
          // Clear cache and refetch
          this.cache = null;
          const tickets = await this.getTickets(registerId);
          callback(tickets);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ticket_lines",
        },
        async (payload: any) => {
          console.log("[Tickets] Ticket line changed:", payload);
          
          // Clear cache and refetch
          this.cache = null;
          const tickets = await this.getTickets(registerId);
          callback(tickets);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }

  /**
   * Migrate localStorage tickets to database
   */
  async migrateFromLocalStorage(
    registerId: string,
    orgId: string,
    storeId: string,
    memberId: string
  ): Promise<void> {
    try {
      const localTickets = localStorage.getItem("pos_saved_tickets");
      if (!localTickets) return;

      const tickets = JSON.parse(localTickets);
      if (!Array.isArray(tickets) || tickets.length === 0) return;

      console.log("[Tickets] Migrating", tickets.length, "tickets from localStorage");

      for (const ticket of tickets) {
        try {
          await this.saveTicket({
            org_id: orgId,
            store_id: storeId,
            register_id: registerId,
            member_id: memberId,
            ticket_number: ticket.ticketNumber || 0,
            status: "parked",
            dining_option: ticket.diningOption || "eat-in",
            customer_name: ticket.customerName,
            table_number: ticket.tableNumber,
            subtotal: ticket.subtotal || 0,
            discount_total: ticket.discountTotal || 0,
            tax_total: ticket.taxTotal || 0,
            tip_total: ticket.tipTotal || 0,
            total: ticket.total || 0,
            lines: ticket.lines?.map((line: any) => ({
              id: line.id,
              item_id: line.item_id,
              variant_id: line.variant_id,
              name: line.name,
              quantity: line.quantity,
              unit_price: line.unit_price,
              discount_amount: line.discount_amount || 0,
              tax_rate: line.tax_rate,
              tax_amount: line.tax_amount || 0,
              total: line.total,
              modifiers: line.modifiers,
              notes: line.notes,
              sort_order: 0,
            })) || [],
          });
        } catch (err) {
          console.error("[Tickets] Failed to migrate ticket:", err);
        }
      }

      // Remove old localStorage tickets
      localStorage.removeItem("pos_saved_tickets");
      console.log("[Tickets] Migration complete");
    } catch (err) {
      console.error("[Tickets] Migration failed:", err);
    }
  }

  /**
   * Clear cache (force refresh)
   */
  clearCache(): void {
    this.cache = null;
  }
}

// Export singleton instance
export const ticketsService = new TicketsService();
