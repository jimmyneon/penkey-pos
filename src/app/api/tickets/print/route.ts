export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { generateTicketText, type TicketData } from "@penkey/print-adapters";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";
import { createTicketPrintJob, getPrinters } from "@/lib/services/print-queue";

export async function POST(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized POST /api/tickets/print`);
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
    console.log("[Ticket Print] Request body:", JSON.stringify(body, null, 2));

    const { printer_id, ticket_data, copies = 1 } = body;
    console.log("[Ticket Print] Copies requested:", copies, "Type:", typeof copies);

    if (!ticket_data) {
      return NextResponse.json(
        { error: "Ticket data is required" },
        { status: 400 }
      );
    }

    // Normalize ticket data to ensure all required fields exist with safe defaults
    // Use store info from ticket data directly (client should provide it, like receipts)
    const normalizedTicketData: TicketData = {
      store_name: ticket_data.store_name || session.register?.store_name || "Penkey Delicaf & Gifts",
      store_address: ticket_data.store_address,
      store_phone: ticket_data.store_phone,
      ticket_name: ticket_data.ticket_name || "Ticket",
      ticket_comment: ticket_data.ticket_comment,
      date: ticket_data.date || new Date().toLocaleDateString("en-GB"),
      time: ticket_data.time || new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      employee_name: ticket_data.employee_name || "Staff",
      register_name: ticket_data.register_name || "Main Till",
      lines: (ticket_data.lines || []).map((line: any) => ({
        quantity: line.quantity ?? 1,
        item_name: line.item_name || "Item",
        variant_name: line.variant_name || null,
        modifiers: line.modifiers || [],
        line_total: line.line_total ?? 0,
      })),
      subtotal: ticket_data.subtotal ?? 0,
      tax: ticket_data.tax ?? 0,
      total: ticket_data.total ?? 0,
      is_paid: ticket_data.is_paid ?? false,
      payment_method: ticket_data.payment_method,
      dining_option: ticket_data.dining_option,
      table_number: ticket_data.table_number,
      customer_name: ticket_data.customer_name,
      assignment: ticket_data.assignment,
    };
    
    console.log('[Ticket Print] Ticket data:', {
      ticket_name: normalizedTicketData.ticket_name,
      total: normalizedTicketData.total,
      is_paid: normalizedTicketData.is_paid,
      dining_option: normalizedTicketData.dining_option,
      table_number: normalizedTicketData.table_number,
      customer_name: normalizedTicketData.customer_name,
    });

    let selectedPrinterId = printer_id;

    // If no printer specified, try to find any printer (don't filter by status -
    // the print server may have a stale heartbeat but will still pick up queued jobs)
    if (!selectedPrinterId) {
      try {
        const printers = await getPrinters(supabaseUrl, supabaseKey);

        if (printers.length > 0) {
          selectedPrinterId = printers[0].id;
        }
      } catch (err: any) {
        console.warn("[Ticket Print] Failed to lookup printers:", err);
        // Fall through to "no printer" path
      }
    }

    if (!selectedPrinterId) {
      // No printer available - return ticket for browser printing
      try {
        const ticketText = generateTicketText(normalizedTicketData);
        return NextResponse.json({
          success: true,
          queued: false,
          message: "No printer configured - use browser print",
          receipt_text: ticketText,
          ticket_data: normalizedTicketData,
        });
      } catch (genError: any) {
        console.error("[Ticket Print] generateTicketText failed:", genError);
        return NextResponse.json(
          { error: `Failed to generate ticket text: ${genError?.message}` },
          { status: 500 }
        );
      }
    }

    // Create print jobs (one per copy)
    const numCopies = Math.min(Math.max(1, copies), 3);
    try {
      for (let i = 0; i < numCopies; i++) {
        await createTicketPrintJob(
          supabaseUrl,
          supabaseKey,
          selectedPrinterId,
          normalizedTicketData,
          session.org_id
        );
      }
    } catch (jobError: any) {
      console.error("[Ticket Print] createTicketPrintJob failed:", jobError);
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
      message: `Ticket queued for printing (${numCopies} ${numCopies === 1 ? 'copy' : 'copies'})`,
      ticket_data: normalizedTicketData,
    });
  } catch (error: any) {
    console.error("Failed to queue ticket print:", error);
    console.error("Error details:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    return NextResponse.json(
      { error: error?.message || "Failed to queue ticket for printing", details: error?.message },
      { status: 500 }
    );
  }
}
