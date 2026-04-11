export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { generateReceiptText, type ReceiptTemplateData } from "@penkey/print-adapters";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";
import { createReceiptPrintJob, getPrinters } from "@/lib/services/print-queue";

export async function POST(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized POST /api/receipts/print`);
    return unauthorizedResponse();
  }

  // ✅ SECURITY: Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const { receipt_id, printer_id } = await request.json();

    if (!receipt_id) {
      return NextResponse.json(
        { error: "Receipt ID is required" },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createSupabaseServerClient(supabaseUrl, supabaseKey);

    // Fetch receipt with all details
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select(`
        *,
        registers(name, stores(name, address)),
        org_members(display_name, first_name),
        receipt_lines(
          quantity,
          unit_price,
          line_total,
          name,
          modifiers
        ),
        payments(method, amount, reference)
      `)
      .eq("id", receipt_id)
      .single();

    if (receiptError) throw receiptError;

    // Format receipt data
    const receiptData: ReceiptTemplateData = {
      store_name: (receipt as any).registers?.stores?.name || "Penkey Délicaf & Gifts",
      store_address: (receipt as any).registers?.stores?.address,
      receipt_number: (receipt as any).receipt_number,
      date: new Date((receipt as any).created_at).toLocaleDateString("en-GB"),
      time: new Date((receipt as any).created_at).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      employee_name:
        (receipt as any).org_members?.display_name ||
        (receipt as any).org_members?.first_name ||
        "Staff",
      register_name: (receipt as any).registers?.name || "Main Till",
      lines: (receipt as any).receipt_lines.map((line: any) => ({
        quantity: line.quantity,
        item_name: line.name,
        variant_name: null,
        modifiers: line.modifiers || [],
        line_total: line.line_total,
      })),
      subtotal: (receipt as any).subtotal,
      tax: (receipt as any).tax_total,
      total: (receipt as any).total,
      payment_method: (receipt as any).payments?.[0]?.method || "cash",
      cash_tendered: (receipt as any).paid_amount,
      cash_change: (receipt as any).change_amount,
    };

    let selectedPrinterId = printer_id;
    
    // If no printer specified, try to find default printer for this register
    if (!selectedPrinterId) {
      const registerId = (receipt as any).register_id;
      const printers = await getPrinters(supabaseUrl, supabaseKey, { 
        register_id: registerId
      });
      
      if (printers.length > 0) {
        selectedPrinterId = printers[0].id;
      }
    }

    if (!selectedPrinterId) {
      // No printer available - return receipt for browser printing
      const receiptText = generateReceiptText(receiptData);
      
      return NextResponse.json({
        success: true,
        queued: false,
        message: "No printer configured - use browser print",
        receipt_text: receiptText,
        receipt_data: receiptData,
      });
    }

    // Create print job in queue
    const printJob = await createReceiptPrintJob(
      supabaseUrl,
      supabaseKey,
      selectedPrinterId,
      receiptData,
      receipt_id
    );

    return NextResponse.json({
      success: true,
      queued: true,
      job_id: printJob.id,
      printer_id: selectedPrinterId,
      message: "Receipt queued for printing",
      receipt_data: receiptData,
    });
  } catch (error: any) {
    console.error("Failed to queue receipt print:", error);
    console.error("Error details:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    return NextResponse.json(
      { error: "Failed to queue receipt for printing", details: error?.message },
      { status: 500 }
    );
  }
}
