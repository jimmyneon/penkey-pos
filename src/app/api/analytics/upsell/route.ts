export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

/**
 * Track upsell analytics events
 */
export async function POST(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized POST /api/analytics/upsell`);
    return unauthorizedResponse();
  }

  // ✅ SECURITY: Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const body = await request.json();
    const { events } = body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: "events array is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Insert analytics events
    const { error } = await supabase
      .from("upsell_analytics")
      .insert(events);

    if (error) {
      console.error("[Analytics] Failed to insert events:", error);
      throw error;
    }

    console.log(`[Analytics] Tracked ${events.length} upsell events`);

    return NextResponse.json({ 
      success: true, 
      count: events.length 
    });
  } catch (error: any) {
    console.error("Failed to track analytics:", error);
    return NextResponse.json(
      { error: "Failed to track analytics", details: error.message },
      { status: 500 }
    );
  }
}
