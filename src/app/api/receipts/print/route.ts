export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { generateReceiptText, type ReceiptTemplateData } from "@penkey/print-adapters";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

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
    const { receipt_id } = await request.json();

    if (!receipt_id) {
      return NextResponse.json(
        { error: "Receipt ID is required" },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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
        item_name: line.name, // Use name snapshot from receipt_lines
        variant_name: null, // Not stored separately
        modifiers: line.modifiers || [],
        line_total: line.line_total,
      })),
      subtotal: (receipt as any).subtotal,
      tax: (receipt as any).tax_total, // Column is tax_total not tax
      total: (receipt as any).total,
      payment_method: (receipt as any).payments?.[0]?.method || "cash", // Column is method not payment_method
      cash_tendered: (receipt as any).paid_amount, // Use paid_amount from receipt
      cash_change: (receipt as any).change_amount, // Use change_amount from receipt
    };

    // Generate receipt text
    const receiptText = generateReceiptText(receiptData);

    // TODO: Send to printer
    // For now, return the receipt text for browser printing
    // In production, this would send to Epson printer via ePOS-Print API

    return NextResponse.json({
      success: true,
      receipt_text: receiptText,
      receipt_data: receiptData,
    });
  } catch (error: any) {
    console.error("Failed to print receipt:", error);
    return NextResponse.json(
      { error: "Failed to print receipt" },
      { status: 500 }
    );
  }
}
