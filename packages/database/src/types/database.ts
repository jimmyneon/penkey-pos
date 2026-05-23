// This file contains database types for Penkey POS
// Generated manually - update when schema changes

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PrinterType = 'epson' | 'star' | 'escpos';
export type ConnectionType = 'lan' | 'usb' | 'bluetooth' | 'cups';
export type PrinterStatus = 'online' | 'offline' | 'error' | 'printing';
export type PrintJobType = 'receipt' | 'report' | 'test' | 'label';
export type PrintJobPriority = 'high' | 'normal' | 'low';
export type PrintJobStatus = 'pending' | 'printing' | 'completed' | 'failed' | 'cancelled';
export type QRCodeType = 'google_review' | 'website' | 'custom';

export interface Printer {
  id: string;
  name: string;
  type: PrinterType;
  connection_type: ConnectionType;
  ip_address: string | null;
  port: number;
  device_path: string | null;
  cups_printer_name: string | null;
  paper_width: 58 | 80;
  location: string | null;
  register_id: string | null;
  store_id: string | null;
  status: PrinterStatus;
  last_seen_at: string | null;
  last_error: string | null;
  config: Json;
  created_at: string;
  updated_at: string;
}

export interface PrintJob {
  id: string;
  printer_id: string;
  job_type: PrintJobType;
  template: string;
  data: Json;
  priority: PrintJobPriority;
  status: PrintJobStatus;
  receipt_id: string | null;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  printed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QRCode {
  id: string;
  org_id: string;
  store_id: string | null;
  code_type: QRCodeType;
  name: string;
  target_url: string;
  unique_code: string;
  is_active: boolean;
  config: Json;
  created_at: string;
  updated_at: string;
}

export interface QRScan {
  id: string;
  qr_code_id: string;
  receipt_id: string | null;
  store_id: string | null;
  user_agent: string | null;
  ip_address: string | null;
  referrer: string | null;
  scanned_at: string;
}

export interface Database {
  public: {
    Tables: {
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
      qr_codes: {
        Row: QRCode;
        Insert: Omit<QRCode, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<QRCode>;
      };
      qr_scans: {
        Row: QRScan;
        Insert: Omit<QRScan, 'id' | 'scanned_at'> & {
          id?: string;
          scanned_at?: string;
        };
        Update: Partial<QRScan>;
      };
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
      qr_code_type: QRCodeType;
    };
  };
}
