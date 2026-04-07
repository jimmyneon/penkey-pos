export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized GET /api/stats/top-sellers`);
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

    // ✅ SECURITY: Verify org_id matches session
    if (!orgId || orgId !== session.org_id) {
      console.warn(`[API-AUTH] Org mismatch - Request: ${orgId}, Session: ${session.org_id}`);
      return unauthorizedResponse();
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get top selling items today
    const { data: topSellers, error } = await (supabase as any)
      .rpc('get_top_sellers_today', {
        p_org_id: orgId,
        p_start_date: today.toISOString(),
        p_end_date: tomorrow.toISOString(),
        p_limit: 8
      });

    if (error) {
      console.error("[TopSellers] Database error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      topSellers: topSellers || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[TopSellers] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch top sellers" },
      { status: 500 }
    );
  }
}
