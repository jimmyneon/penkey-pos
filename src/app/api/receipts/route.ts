import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@penkey/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized GET /api/receipts`);
    return unauthorizedResponse();
  }

  // ✅ SECURITY: Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    console.warn(`[API-RATELIMIT] Blocked GET /api/receipts - User: ${session.user_id}`);
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Database configuration missing" },
        { status: 500 }
      );
    }

    const supabase = createSupabaseServerClient(supabaseUrl, supabaseServiceKey);

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const orgId = searchParams.get("org_id");
    const storeId = searchParams.get("store_id");
    const registerId = searchParams.get("register_id");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    // ✅ SECURITY: Verify org_id matches session
    if (!orgId || orgId !== session.org_id) {
      console.warn(`[API-AUTH] Org mismatch - Request: ${orgId}, Session: ${session.org_id}`);
      return unauthorizedResponse();
    }

    if (!orgId) {
      return NextResponse.json(
        { error: "org_id is required" },
        { status: 400 }
      );
    }

    // Build query
    let query = supabase
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
        status,
        member:org_members!receipts_member_id_fkey (
          first_name,
          last_name
        ),
        payments (
          id,
          method,
          amount,
          tip_amount
        )
      `)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (storeId) {
      query = query.eq("store_id", storeId);
    }
    if (registerId) {
      query = query.eq("register_id", registerId);
    }
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data: receipts, error } = await query;

    if (error) {
      console.error("Error fetching receipts:", error);
      return NextResponse.json(
        { error: "Failed to fetch receipts" },
        { status: 500 }
      );
    }

    return NextResponse.json({ receipts });
  } catch (error) {
    console.error("Error in receipts API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
