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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const body = await request.json();
    console.log("[Print] Request body:", JSON.stringify(body, null, 2));

    const { receipt_id, printer_id, receipt_data, copies = 1 } = body;

    if (!receipt_id && !receipt_data) {
      return NextResponse.json(
        { error: "Receipt ID or receipt data is required" },
        { status: 400 }
      );
    }

    // If full receipt data is provided (for temp receipts), use it directly
    if (receipt_data) {
      let selectedPrinterId = printer_id;

      // If no printer specified, try to find default printer for this register
      if (!selectedPrinterId) {
        const registerId = receipt_data.register_id;
        const printers = await getPrinters(supabaseUrl, supabaseKey, {
          register_id: registerId
        });

        if (printers.length > 0) {
          selectedPrinterId = printers[0].id;
        }
      }

      if (!selectedPrinterId) {
        // No printer available - return receipt for browser printing
        const receiptText = generateReceiptText(receipt_data);

        return NextResponse.json({
          success: true,
          queued: false,
          message: "No printer configured - use browser print",
          receipt_text: receiptText,
          receipt_data: receipt_data,
        });
      }

      // Create print jobs (one per copy)
      const numCopies = Math.min(Math.max(1, copies), 3);
      for (let i = 0; i < numCopies; i++) {
        await createReceiptPrintJob(
          supabaseUrl,
          supabaseKey,
          selectedPrinterId,
          receipt_data,
          receipt_id
        );
      }

      return NextResponse.json({
        success: true,
        queued: true,
        copies: numCopies,
        printer_id: selectedPrinterId,
        message: `Receipt queued for printing (${numCopies} ${numCopies === 1 ? 'copy' : 'copies'})`,
        receipt_data: receipt_data,
      });
    }

    // Check for temp receipt IDs (still syncing to database)
    if (receipt_id && receipt_id.startsWith('temp_')) {
      return NextResponse.json(
        { error: "Receipt is still syncing to database. Please try again in a few seconds." },
        { status: 409 }
      );
    }

    const supabase = createSupabaseServerClient(supabaseUrl, supabaseKey);

    // Fetch receipt base data
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select("*")
      .eq("id", receipt_id)
      .single();

    if (receiptError) {
      console.error("[Print] Receipt fetch error:", receiptError);
      throw new Error(`Receipt fetch failed: ${receiptError.message}`);
    }

    if (!receipt) {
      return NextResponse.json(
        { error: "Receipt not found" },
        { status: 404 }
      );
    }

    const r = receipt as any;

    // Fetch related data separately to avoid complex nested selects
    let storeName = "Penkey Délicaf & Gifts";
    let storeAddress: string | undefined = undefined;
    let registerName = "Main Till";
    let employeeName = "Staff";

    try {
      if (r.register_id) {
        const { data: register } = await supabase
          .from("registers")
          .select("name, stores(name, address)")
          .eq("id", r.register_id)
          .maybeSingle();
        if (register) {
          registerName = (register as any).name || "Main Till";
          if ((register as any).stores) {
            storeName = (register as any).stores.name || storeName;
            storeAddress = (register as any).stores.address;
          }
        }
      }
    } catch (e) {
      console.warn("[Print] Failed to fetch register/store info:", e);
    }

    try {
      if (r.member_id) {
        const { data: member } = await supabase
          .from("org_members")
          .select("display_name, first_name")
          .eq("id", r.member_id)
          .maybeSingle();
        if (member) {
          employeeName = (member as any).display_name || (member as any).first_name || "Staff";
        }
      }
    } catch (e) {
      console.warn("[Print] Failed to fetch employee info:", e);
    }

    // Fetch receipt lines
    let lines: any[] = [];
    try {
      const { data: receiptLines } = await supabase
        .from("receipt_lines")
        .select("quantity, unit_price, line_total, name, modifiers")
        .eq("receipt_id", receipt_id)
        .order("sort_order", { ascending: true });
      lines = receiptLines || [];
    } catch (e) {
      console.warn("[Print] Failed to fetch receipt lines:", e);
    }

    // Fetch payment method
    let paymentMethod = "cash";
    try {
      const { data: payments } = await supabase
        .from("payments")
        .select("method")
        .eq("receipt_id", receipt_id)
        .limit(1);
      if (payments && payments.length > 0) {
        paymentMethod = payments[0].method || "cash";
      }
    } catch (e) {
      console.warn("[Print] Failed to fetch payment method:", e);
    }

    // Format receipt data
    const receiptData: ReceiptTemplateData = {
      store_name: storeName,
      store_address: storeAddress,
      receipt_number: r.receipt_number ?? 0,
      date: new Date(r.created_at).toLocaleDateString("en-GB"),
      time: new Date(r.created_at).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      employee_name: employeeName,
      register_name: registerName,
      lines: lines.map((line: any) => ({
        quantity: line.quantity ?? 1,
        item_name: line.name || line.item_name || "Item",
        variant_name: null,
        modifiers: line.modifiers || [],
        line_total: line.line_total ?? 0,
      })),
      subtotal: r.subtotal ?? r.total ?? 0,
      tax: r.tax_total ?? 0,
      total: r.total ?? 0,
      payment_method: paymentMethod,
      cash_tendered: r.paid_amount,
      cash_change: r.change_amount,
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

    // Create print jobs (one per copy)
    const numCopies = Math.min(Math.max(1, copies), 3);
    for (let i = 0; i < numCopies; i++) {
      await createReceiptPrintJob(
        supabaseUrl,
        supabaseKey,
        selectedPrinterId,
        receiptData,
        receipt_id
      );
    }

    return NextResponse.json({
      success: true,
      queued: true,
      copies: numCopies,
      printer_id: selectedPrinterId,
      message: `Receipt queued for printing (${numCopies} ${numCopies === 1 ? 'copy' : 'copies'})`,
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
      { error: error?.message || "Failed to queue receipt for printing", details: error?.message },
      { status: 500 }
    );
  }
}
