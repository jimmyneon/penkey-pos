import { createClient } from "@supabase/supabase-js";
import type { Printer, PrintJob, PrinterType, ConnectionType, PrinterStatus, PrintJobType, PrintJobPriority, PrintJobStatus } from "@penkey/database";

// Define your database types here or import from a generated file
export interface Database {
  public: {
    Tables: {
      // Add your table types here
      categories: {
        Row: any;
        Insert: any;
        Update: any;
      };
      items: {
        Row: any;
        Insert: any;
        Update: any;
      };
      modifiers: {
        Row: any;
        Insert: any;
        Update: any;
      };
      receipts: {
        Row: any;
        Insert: any;
        Update: any;
      };
      shifts: {
        Row: any;
        Insert: any;
        Update: any;
      };
      terminals: {
        Row: {
          id: string;
          name: string;
          reader_id: string;
          location?: string;
          status: 'online' | 'offline' | 'pairing';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          reader_id: string;
          location?: string;
          status?: 'online' | 'offline' | 'pairing';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          reader_id?: string;
          location?: string;
          status?: 'online' | 'offline' | 'pairing';
          updated_at?: string;
        };
      };
      printers: {
        Row: Printer;
        Insert: Omit<Printer, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Printer>;
      };
      print_jobs: {
        Row: PrintJob;
        Insert: Omit<PrintJob, 'id' | 'created_at' | 'updated_at' | 'attempts'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          attempts?: number;
        };
        Update: Partial<PrintJob>;
      };
      // Add other tables as needed
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      printer_type: PrinterType;
      connection_type: ConnectionType;
      printer_status: PrinterStatus;
      print_job_type: PrintJobType;
      print_job_priority: PrintJobPriority;
      print_job_status: PrintJobStatus;
    };
  };
}

export function createSupabaseClient(
  supabaseUrl: string,
  supabaseKey: string
) {
  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

export function createSupabaseServerClient(
  supabaseUrl: string,
  serviceRoleKey: string
) {
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export type SupabaseClient = ReturnType<typeof createSupabaseClient>;
