/**
 * Print Queue Service
 * Manages printer configuration and print jobs with Supabase real-time
 */

import { createSupabaseClient } from "@/lib/database";
import type { Printer, PrintJob, PrintJobType, PrintJobPriority } from "@penkey/database";
import { generateReceiptText, type ReceiptTemplateData } from "@penkey/print-adapters";

export interface CreatePrintJobInput {
  printer_id: string;
  type: PrintJobType;
  template_id?: string | null;
  data: Record<string, any>;
  priority?: "high" | "normal" | "low";
  receipt_id?: string | null;
}

export interface PrinterConfig {
  name: string;
  type: "epson" | "star" | "escpos";
  connection_type: "lan" | "usb" | "bluetooth" | "cups";
  ip_address?: string;
  port?: number;
  device_path?: string;
  cups_printer_name?: string;
  paper_width: 58 | 80;
  location?: string;
  register_id?: string;
  store_id?: string;
  config?: Record<string, any>;
}

// Create a print job
export async function createPrintJob(
  supabaseUrl: string,
  supabaseKey: string,
  input: CreatePrintJobInput
): Promise<PrintJob> {
  const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("print_jobs")
    .insert({
      printer_id: input.printer_id,
      type: input.type,
      template_id: input.template_id || null,
      data: input.data,
      priority: input.priority || "normal",
      receipt_id: input.receipt_id || null,
      status: "pending",
      attempts: 0,
      max_attempts: 3,
    })
    .select()
    .single();

  if (error) throw error;
  return data as PrintJob;
}

// Create a receipt print job
export async function createReceiptPrintJob(
  supabaseUrl: string,
  supabaseKey: string,
  printer_id: string,
  receiptData: ReceiptTemplateData,
  receipt_id?: string
): Promise<PrintJob> {
  const receiptText = generateReceiptText(receiptData);

  // Fetch printer config to include printer settings
  const supabase = createSupabaseClient(supabaseUrl, supabaseKey);
  const { data: printer } = await supabase
    .from("printers")
    .select("config")
    .eq("id", printer_id)
    .single();

  const printerSettings = printer?.config || {};

  return createPrintJob(supabaseUrl, supabaseKey, {
    printer_id,
    type: "receipt",
    template_id: null,
    data: {
      receipt_text: receiptText,
      ...receiptData,
      printer_settings: printerSettings,
    },
    priority: "normal",
    receipt_id,
  });
}

// Get pending jobs for a printer
export async function getPendingPrintJobs(
  supabaseUrl: string,
  supabaseKey: string,
  printer_id: string
): Promise<PrintJob[]> {
  const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("print_jobs")
    .select("*")
    .eq("printer_id", printer_id)
    .eq("status", "pending")
    .order("priority", { ascending: false }) // high first
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []) as PrintJob[];
}

// Update job status
export async function updatePrintJobStatus(
  supabaseUrl: string,
  supabaseKey: string,
  job_id: string,
  status: PrintJob["status"],
  error_message?: string
): Promise<void> {
  const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

  const updates: Partial<PrintJob> = { status };

  if (status === "printing") {
    // Increment attempts when starting to print
    const { data: job } = await supabase
      .from("print_jobs")
      .select("attempts")
      .eq("id", job_id)
      .single();
    
    updates.attempts = (job?.attempts || 0) + 1;
  }

  if (status === "completed") {
    // printed_at column doesn't exist in database
  }

  if (error_message) {
    updates.error_message = error_message;
  }

  const { error } = await supabase
    .from("print_jobs")
    .update(updates)
    .eq("id", job_id);

  if (error) throw error;
}

// Get all printers
export async function getPrinters(
  supabaseUrl: string,
  supabaseKey: string,
  filters?: { register_id?: string; store_id?: string; status?: Printer["status"] }
): Promise<Printer[]> {
  const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

  let query = supabase.from("printers").select("*");

  if (filters?.register_id) {
    query = query.eq("register_id", filters.register_id);
  }

  if (filters?.store_id) {
    query = query.eq("store_id", filters.store_id);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query.order("name");

  if (error) {
    throw error;
  }

  return (data || []) as Printer[];
}

// Get a single printer
export async function getPrinter(
  supabaseUrl: string,
  supabaseKey: string,
  printer_id: string
): Promise<Printer | null> {
  const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("printers")
    .select("*")
    .eq("id", printer_id)
    .single();

  if (error) return null;
  return data as Printer;
}

// Create a printer
export async function createPrinter(
  supabaseUrl: string,
  supabaseKey: string,
  config: PrinterConfig
): Promise<Printer> {
  const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("printers")
    .insert({
      name: config.name,
      type: config.type,
      connection_type: config.connection_type,
      ip_address: config.ip_address || null,
      port: config.port || 8008,
      device_path: config.device_path || null,
      cups_printer_name: config.cups_printer_name || null,
      paper_width: config.paper_width,
      location: config.location || null,
      register_id: config.register_id || null,
      store_id: config.store_id || null,
      status: "offline",
      config: config.config || {},
    })
    .select()
    .single();

  if (error) throw error;
  return data as Printer;
}

// Update printer status
export async function updatePrinterStatus(
  supabaseUrl: string,
  supabaseKey: string,
  printer_id: string,
  status: Printer["status"],
  last_error?: string
): Promise<void> {
  const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

  const updates: Partial<Printer> = { 
    status,
    last_seen_at: new Date().toISOString(),
  };

  if (last_error) {
    updates.last_error = last_error;
  }

  const { error } = await supabase
    .from("printers")
    .update(updates)
    .eq("id", printer_id);

  if (error) throw error;
}

// Update printer
export async function updatePrinter(
  supabaseUrl: string,
  supabaseKey: string,
  printer_id: string,
  updates: Partial<PrinterConfig>
): Promise<Printer> {
  const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

  const dbUpdates: Partial<Printer> = {
    ...updates,
    ip_address: updates.ip_address ?? null,
    device_path: updates.device_path ?? null,
    cups_printer_name: updates.cups_printer_name ?? null,
    location: updates.location ?? null,
    register_id: updates.register_id ?? null,
    store_id: updates.store_id ?? null,
    config: updates.config,
  };

  const { data, error } = await supabase
    .from("printers")
    .update(dbUpdates)
    .eq("id", printer_id)
    .select()
    .single();

  if (error) throw error;
  return data as Printer;
}

// Delete printer
export async function deletePrinter(
  supabaseUrl: string,
  supabaseKey: string,
  printer_id: string
): Promise<void> {
  const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

  const { error } = await supabase
    .from("printers")
    .delete()
    .eq("id", printer_id);

  if (error) throw error;
}

// Get print job statistics
export async function getPrintJobStats(
  supabaseUrl: string,
  supabaseKey: string,
  printer_id?: string,
  start_date?: string,
  end_date?: string
): Promise<{
  total: number;
  pending: number;
  completed: number;
  failed: number;
  printing: number;
}> {
  const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

  let query = supabase.from("print_jobs").select("status", { count: "exact" });

  if (printer_id) {
    query = query.eq("printer_id", printer_id);
  }

  if (start_date) {
    query = query.gte("created_at", start_date);
  }

  if (end_date) {
    query = query.lte("created_at", end_date);
  }

  const { data, error } = await query;

  if (error) throw error;

  const jobs = data || [];
  
  return {
    total: jobs.length,
    pending: jobs.filter((j: any) => j.status === "pending").length,
    completed: jobs.filter((j: any) => j.status === "completed").length,
    failed: jobs.filter((j: any) => j.status === "failed").length,
    printing: jobs.filter((j: any) => j.status === "printing").length,
  };
}

// Retry failed jobs
export async function retryFailedPrintJobs(
  supabaseUrl: string,
  supabaseKey: string,
  printer_id: string
): Promise<number> {
  const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("print_jobs")
    .update({
      status: "pending",
      attempts: 0,
      error_message: null,
    })
    .eq("printer_id", printer_id)
    .eq("status", "failed")
    .select();

  if (error) throw error;
  return data?.length || 0;
}

// Cancel pending jobs
export async function cancelPendingPrintJobs(
  supabaseUrl: string,
  supabaseKey: string,
  printer_id: string
): Promise<number> {
  const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("print_jobs")
    .update({ status: "cancelled" })
    .eq("printer_id", printer_id)
    .eq("status", "pending")
    .select();

  if (error) throw error;
  return data?.length || 0;
}
