export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized GET /api/stats/daily`);
    return unauthorizedResponse();
  }

  // ✅ SECURITY: Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const orgId = searchParams.get("org_id");

    // ✅ SECURITY: Verify org_id matches session
    if (!orgId || orgId !== session.org_id) {
      console.warn(`[API-AUTH] Org mismatch - Request: ${orgId}, Session: ${session.org_id}`);
      return unauthorizedResponse();
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get today's date range (start of day to now)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();

    // Fetch today's receipts
    const { data: receipts, error: receiptsError } = await supabase
      .from("receipts")
      .select("id, total, created_at")
      .eq("org_id", orgId)
      .gte("created_at", todayStart)
      .eq("status", "completed");

    if (receiptsError) {
      console.error("Error fetching receipts:", receiptsError);
      return NextResponse.json(
        { error: "Failed to fetch receipts" },
        { status: 500 }
      );
    }

    // Calculate total sales
    const totalSales = receipts?.reduce((sum: number, r: any) => sum + (r.total || 0), 0) || 0;

    // Fetch today's receipt lines to count items
    const receiptIds = receipts?.map((r: any) => r.id) || [];
    let itemsSold = 0;

    if (receiptIds.length > 0) {
      const { data: lines, error: linesError } = await supabase
        .from("receipt_lines")
        .select("quantity")
        .in("receipt_id", receiptIds);

      if (!linesError && lines) {
        itemsSold = lines.reduce((sum: number, line: any) => sum + (line.quantity || 0), 0);
      }
    }

    // Fetch upsell analytics for today
    const { data: upsells, error: upsellsError } = await supabase
      .from("upsell_analytics")
      .select("id")
      .eq("org_id", orgId)
      .eq("action", "accepted")
      .gte("created_at", todayStart);

    const upsellCount = upsells?.length || 0;

    return NextResponse.json({
      sales: totalSales,
      upsellCount,
      itemsSold,
      transactionCount: receipts?.length || 0,
    });
  } catch (error) {
    console.error("Error in daily stats API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
