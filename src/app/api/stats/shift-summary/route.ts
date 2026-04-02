import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized GET /api/stats/shift-summary`);
    return unauthorizedResponse();
  }

  // ✅ SECURITY: Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const orgId = searchParams.get("org_id");
    const memberId = searchParams.get("member_id");

    // ✅ SECURITY: Verify org_id matches session
    if (!orgId || orgId !== session.org_id || !memberId) {
      console.warn(`[API-AUTH] Org mismatch - Request: ${orgId}, Session: ${session.org_id}`);
      return unauthorizedResponse();
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get shift summary for this employee today
    const { data: shiftData, error } = await (supabase as any)
      .rpc('get_shift_summary', {
        p_org_id: orgId,
        p_member_id: memberId,
        p_start_date: today.toISOString(),
        p_end_date: tomorrow.toISOString()
      });

    if (error) {
      console.error("[ShiftSummary] Database error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const summary = shiftData?.[0] || {
      transactions: 0,
      total_sales: 0,
      avg_ticket: 0,
      items_sold: 0,
      upsells: 0,
      shift_start: today.toISOString(),
    };

    return NextResponse.json({
      ...summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[ShiftSummary] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch shift summary" },
      { status: 500 }
    );
  }
}
