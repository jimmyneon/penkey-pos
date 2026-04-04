import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized GET /api/receipts/[id]`);
    return unauthorizedResponse();
  }

  // ✅ SECURITY: Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const { id } = await params;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Database configuration missing" },
        { status: 500 }
      );
    }

    const supabase = createSupabaseServerClient(supabaseUrl, supabaseServiceKey);

    // Fetch receipt with all details
    const { data: receipt, error } = await supabase
      .from("receipts")
      .select(`
        id,
        receipt_number,
        created_at,
        dining_option,
        customer_name,
        table_number,
        subtotal,
        discount_total,
        tax_total,
        tip_total,
        total,
        paid_amount,
        change_amount,
        refunded_amount,
        status,
        member:org_members!receipts_member_id_fkey (
          first_name,
          last_name
        ),
        store:stores (
          name,
          address,
          phone,
          receipt_header,
          receipt_footer
        ),
        register:registers (
          name
        ),
        payments (
          id,
          method,
          amount,
          tip_amount,
          reference
        )
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching receipt:", error);
      return NextResponse.json(
        { error: "Receipt not found" },
        { status: 404 }
      );
    }

    // Fetch receipt lines separately
    const { data: lines, error: linesError } = await supabase
      .from("receipt_lines")
      .select(`
        id,
        item_id,
        variant_id,
        name,
        quantity,
        unit_price,
        discount_amount,
        tax_rate,
        tax_amount,
        line_total,
        modifiers,
        notes
      `)
      .eq("receipt_id", id)
      .order("sort_order", { ascending: true });

    if (linesError) {
      console.error("Error fetching receipt lines:", linesError);
    }

    // Combine receipt with lines
    const receiptWithLines = {
      ...(receipt as any),
      lines: lines || [],
    };

    return NextResponse.json({
      receipt: receiptWithLines,
    });
  } catch (error) {
    console.error("Error in receipt detail API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
