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
    const supabase = createSupabaseServerClient(supabaseUrl, supabaseKey);

    const body = await request.json();
    console.log("[Print] Request body:", JSON.stringify(body, null, 2));

    const { receipt_id, printer_id, receipt_data, copies = 1 } = body;
    console.log("[Print] Copies requested:", copies, "Type:", typeof copies);

    if (!receipt_id && !receipt_data) {
      return NextResponse.json(
        { error: "Receipt ID or receipt data is required" },
        { status: 400 }
      );
    }

    // If full receipt data is provided (for temp receipts), use it directly
    if (receipt_data) {
      console.log("[Print] receipt_data keys:", Object.keys(receipt_data));
      console.log("[Print] receipt_data sample:", JSON.stringify(receipt_data).substring(0, 500));

      // Fetch receipt template from print_templates table
      let templateHeader = "PENKEY DELICAF\n5 New Street, Lymington\nWhatsApp Pre-orders: 01590 619472";
      
      if (session.org_id) {
        try {
          const { data: template } = await supabase
            .from("print_templates")
            .select("template")
            .eq("org_id", session.org_id)
            .eq("type", "receipt")
            .eq("is_default", true)
            .maybeSingle();
          
          if (template && template.template) {
            templateHeader = template.template;
            console.log("[Print] Using custom receipt template for org:", session.org_id);
          }
        } catch (err) {
          console.warn("[Print] Failed to fetch receipt template, using defaults:", err);
        }
      }

      // Parse header to extract store info
      const headerLines = templateHeader.split('\n');
      const storeName = headerLines[0] || "Penkey Delicaf & Gifts";
      const storeAddress = headerLines[1] || undefined;
      const storePhone = headerLines[2] || undefined;

      // Normalize receipt data to ensure all required fields exist with safe defaults
      const normalizedReceiptData = {
        store_name: receipt_data.store_name || storeName,
        store_address: receipt_data.store_address || storeAddress,
        store_phone: receipt_data.store_phone || storePhone,
        receipt_number: receipt_data.receipt_number ?? 0,
        date: receipt_data.date || new Date().toLocaleDateString("en-GB"),
        time: receipt_data.time || new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        employee_name: receipt_data.employee_name || "Staff",
        register_name: receipt_data.register_name || "Main Till",
        lines: (receipt_data.lines || []).map((line: any) => ({
          quantity: line.quantity ?? 1,
          item_name: line.item_name || line.name || "Item",
          variant_name: line.variant_name || null,
          modifiers: line.modifiers || [],
          line_total: line.line_total ?? 0,
        })),
        subtotal: receipt_data.subtotal ?? 0,
        tax: receipt_data.tax_total ?? receipt_data.tax ?? 0,
        total: receipt_data.total ?? 0,
        payment_method: receipt_data.payment_method || "cash",
        cash_tendered: receipt_data.paid_amount ?? receipt_data.cash_tendered,
        cash_change: receipt_data.change_amount ?? receipt_data.cash_change,
        // Transaction metadata
        dining_option: receipt_data.dining_option,
        table_number: receipt_data.table_number,
        transaction_id: receipt_data.transaction_id || receipt_data.id,
        customer_name: receipt_data.customer_name,
      };
      
      console.log('[Print] Customer/Table data:', {
        dining_option: normalizedReceiptData.dining_option,
        table_number: normalizedReceiptData.table_number,
        customer_name: normalizedReceiptData.customer_name,
        transaction_id: normalizedReceiptData.transaction_id
      });

      let selectedPrinterId = printer_id;

      // If no printer specified, prefer an online printer (has a print server connected)
      // Fall back to any active printer if none are online
      if (!selectedPrinterId) {
        try {
          const onlinePrinters = await getPrinters(supabaseUrl, supabaseKey, { status: "online" });
          if (onlinePrinters.length > 0) {
            selectedPrinterId = onlinePrinters[0].id;
          } else {
            const allPrinters = await getPrinters(supabaseUrl, supabaseKey);
            if (allPrinters.length > 0) {
              selectedPrinterId = allPrinters[0].id;
            }
          }
        } catch (err: any) {
          console.warn("[Print] Failed to lookup printers:", err);
        }
      }

      if (!selectedPrinterId) {
        // No printer available - return receipt for browser printing
        try {
          const receiptText = generateReceiptText(normalizedReceiptData);
          return NextResponse.json({
            success: true,
            queued: false,
            message: "No printer configured - use browser print",
            receipt_text: receiptText,
            receipt_data: normalizedReceiptData,
          });
        } catch (genError: any) {
          console.error("[Print] generateReceiptText failed:", genError);
          return NextResponse.json(
            { error: `Failed to generate receipt text: ${genError?.message}` },
            { status: 500 }
          );
        }
      }

      // Create print jobs (one per copy)
      const numCopies = Math.min(Math.max(1, copies), 3);
      // Only pass receipt_id if it's a valid UUID (not a temp ID)
      const validReceiptId = receipt_id && !receipt_id.startsWith('temp_') ? receipt_id : undefined;
      try {
        for (let i = 0; i < numCopies; i++) {
          await createReceiptPrintJob(
            supabaseUrl,
            supabaseKey,
            selectedPrinterId,
            normalizedReceiptData,
            validReceiptId,
            session.org_id
          );
        }
      } catch (jobError: any) {
        console.error("[Print] createReceiptPrintJob failed:", jobError);
        return NextResponse.json(
          { error: `Failed to create print job: ${jobError?.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        queued: true,
        copies: numCopies,
        printer_id: selectedPrinterId,
        message: `Receipt queued for printing (${numCopies} ${numCopies === 1 ? 'copy' : 'copies'})`,
        receipt_data: normalizedReceiptData,
      });
    }

    // Check for temp receipt IDs (still syncing to database)
    if (receipt_id && receipt_id.startsWith('temp_')) {
      return NextResponse.json(
        { error: "Receipt is still syncing to database. Please try again in a few seconds." },
        { status: 409 }
      );
    }

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

    // Fetch receipt template, register/store, employee, lines, and payments in parallel
    let templateHeader = "PENKEY DELICAF\n5 New Street, Lymington\nWhatsApp Pre-orders: 01590 619472";
    let registerName = "Main Till";
    let employeeName = "Staff";
    let storeName = "Penkey Delicaf & Gifts";
    let storeAddress: string | undefined;
    let storePhone: string | undefined;
    let lines: any[] = [];
    let paymentMethod = "cash";

    const [templateResult, registerResult, memberResult, linesResult, paymentsResult] = await Promise.all([
      // Fetch receipt template
      r.org_id ? supabase.from("print_templates").select("template").eq("org_id", r.org_id).eq("type", "receipt").eq("is_default", true).maybeSingle() : Promise.resolve({ data: null }),
      // Fetch register/store info
      r.register_id ? supabase.from("registers").select("name, stores(name, address, phone)").eq("id", r.register_id).maybeSingle() : Promise.resolve({ data: null }),
      // Fetch employee info
      r.member_id ? supabase.from("org_members").select("display_name, first_name").eq("id", r.member_id).maybeSingle() : Promise.resolve({ data: null }),
      // Fetch receipt lines
      supabase.from("receipt_lines").select("quantity, unit_price, line_total, name, modifiers").eq("receipt_id", receipt_id).order("sort_order", { ascending: true }),
      // Fetch payment method
      supabase.from("payments").select("method").eq("receipt_id", receipt_id).limit(1),
    ]);

    if (templateResult?.data?.template) {
      templateHeader = templateResult.data.template;
      console.log("[Print] Using custom receipt template for org:", r.org_id);
    }

    if (registerResult?.data) {
      registerName = (registerResult.data as any).name || registerName;
      if ((registerResult.data as any).stores) {
        storeName = (registerResult.data as any).stores.name || storeName;
        storeAddress = (registerResult.data as any).stores.address;
        storePhone = (registerResult.data as any).stores.phone;
      }
    }

    if (memberResult?.data) {
      employeeName = (memberResult.data as any).first_name || employeeName;
    }

    lines = linesResult?.data || [];
    if (paymentsResult?.data && paymentsResult.data.length > 0) {
      paymentMethod = paymentsResult.data[0].method || paymentMethod;
    }

    // Format receipt data
    const receiptData: ReceiptTemplateData = {
      store_name: storeName,
      store_address: storeAddress,
      store_phone: storePhone,
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
      // Transaction metadata
      dining_option: r.dining_option,
      table_number: r.table_number,
      transaction_id: receipt_id,
      customer_name: r.customer_name,
    };

    let selectedPrinterId = printer_id;

    // If no printer specified, prefer an online printer (has a print server connected)
    // Fall back to any active printer if none are online
    if (!selectedPrinterId) {
      try {
        const onlinePrinters = await getPrinters(supabaseUrl, supabaseKey, { status: "online" });
        if (onlinePrinters.length > 0) {
          selectedPrinterId = onlinePrinters[0].id;
        } else {
          const allPrinters = await getPrinters(supabaseUrl, supabaseKey);
          if (allPrinters.length > 0) {
            selectedPrinterId = allPrinters[0].id;
          }
        }
      } catch (err: any) {
        console.warn("[Print] Failed to lookup printers:", err);
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
        receipt_id,
        session.org_id
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
