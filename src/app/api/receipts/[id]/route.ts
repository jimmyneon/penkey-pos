export const dynamic = 'force-dynamic';
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
          reference,
          metadata
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized PATCH /api/receipts/[id]`);
    return unauthorizedResponse();
  }

  // ✅ SECURITY: Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { customer_id, customer_name, customer_email, customer_phone } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Database configuration missing" },
        { status: 500 }
      );
    }

    const supabase = createSupabaseServerClient(supabaseUrl, supabaseServiceKey);

    // Update receipt with customer data
    const { data: receipt, error } = await supabase
      .from("receipts")
      .update({
        customer_id: customer_id || null,
        customer_name: customer_name || null,
        customer_email: customer_email || null,
        customer_phone: customer_phone || null,
      })
      .eq("id", id)
      .eq("org_id", session.org_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating receipt:", error);
      return NextResponse.json(
        { error: "Failed to update receipt" },
        { status: 500 }
      );
    }

    // Sync customer record if provided
    if (customer_id && customer_name) {
      try {
        const nameParts = customer_name.trim().split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        await supabase.from("customers").upsert(
          {
            id: customer_id,
            org_id: session.org_id,
            first_name: firstName,
            last_name: lastName,
            email: customer_email || null,
            phone: customer_phone || null,
          },
          { onConflict: "id", ignoreDuplicates: false }
        );
      } catch (customerError) {
        console.error("[Receipt] Failed to sync customer:", customerError);
      }
    }

    return NextResponse.json({ receipt });
  } catch (error) {
    console.error("Error in receipt PATCH API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
