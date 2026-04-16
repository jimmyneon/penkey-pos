/**
 * Ticket Sync Service
 * Syncs saved tickets across multiple devices using Supabase
 */

import { createClient } from '@supabase/supabase-js';
import type { CartLine } from '@/lib/store/cart-store';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface SavedTicket {
  id: string;
  org_id: string;
  register_id: string | null;
  employee_id: string | null;
  name: string;
  comment: string;
  lines: CartLine[];
  ticket_assignment: any;
  total: number;
  created_at: string;
  updated_at: string;
}

export class TicketSyncService {
  /**
   * Load all saved tickets for an org
   */
  static async loadTickets(orgId: string): Promise<SavedTicket[]> {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data, error } = await supabase
        .from('saved_tickets')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('[TicketSync] Loaded', data?.length || 0, 'tickets from database');
      return (data || []) as SavedTicket[];
    } catch (error) {
      console.error('[TicketSync] Failed to load tickets:', error);
      return [];
    }
  }

  /**
   * Save a new ticket
   */
  static async saveTicket(
    orgId: string,
    registerId: string,
    employeeId: string,
    name: string,
    comment: string,
    lines: CartLine[],
    ticketAssignment: any,
    total: number
  ): Promise<SavedTicket | null> {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data, error } = await supabase
        .from('saved_tickets')
        .insert({
          org_id: orgId,
          register_id: registerId,
          employee_id: employeeId,
          name,
          comment,
          lines,
          ticket_assignment: ticketAssignment,
          total,
        })
        .select()
        .single();

      if (error) throw error;

      console.log('[TicketSync] Saved ticket:', data.id);
      return data as SavedTicket;
    } catch (error) {
      console.error('[TicketSync] Failed to save ticket:', error);
      return null;
    }
  }

  /**
   * Delete ticket(s)
   */
  static async deleteTickets(ticketIds: string[]): Promise<boolean> {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error } = await supabase
        .from('saved_tickets')
        .delete()
        .in('id', ticketIds);

      if (error) throw error;

      console.log('[TicketSync] Deleted', ticketIds.length, 'ticket(s)');
      return true;
    } catch (error) {
      console.error('[TicketSync] Failed to delete tickets:', error);
      return false;
    }
  }

  /**
   * Migrate existing localStorage tickets to database
   */
  static async migrateLocalTickets(
    orgId: string,
    registerId: string,
    employeeId: string
  ): Promise<number> {
    try {
      // Check if migration already happened
      const migrationFlag = localStorage.getItem('pos_tickets_migrated');
      if (migrationFlag === 'true') {
        console.log('[TicketSync] Migration already completed, skipping');
        return 0;
      }

      const localTickets = localStorage.getItem('pos_saved_tickets');
      if (!localTickets) {
        // No tickets to migrate, set flag
        localStorage.setItem('pos_tickets_migrated', 'true');
        return 0;
      }

      const tickets = JSON.parse(localTickets);
      if (!Array.isArray(tickets) || tickets.length === 0) {
        // No tickets to migrate, set flag
        localStorage.setItem('pos_tickets_migrated', 'true');
        localStorage.removeItem('pos_saved_tickets');
        return 0;
      }

      console.log('[TicketSync] Migrating', tickets.length, 'tickets from localStorage');

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Insert all tickets
      const ticketsToInsert = tickets.map((ticket: any) => ({
        org_id: orgId,
        register_id: registerId,
        employee_id: employeeId,
        name: ticket.name || 'Untitled',
        comment: ticket.comment || '',
        lines: ticket.lines || [],
        ticket_assignment: ticket.assignment || null,
        total: ticket.total || 0,
      }));

      const { error } = await supabase
        .from('saved_tickets')
        .insert(ticketsToInsert);

      if (error) throw error;

      // Clear localStorage and set migration flag
      localStorage.removeItem('pos_saved_tickets');
      localStorage.setItem('pos_tickets_migrated', 'true');
      console.log('[TicketSync] Migration complete, cleared localStorage');

      return tickets.length;
    } catch (error) {
      console.error('[TicketSync] Migration failed:', error);
      // Don't set flag on error so it can retry
      return 0;
    }
  }
}
