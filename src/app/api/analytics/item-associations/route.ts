export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

/**
 * Calculate item associations from historical sales data
 * "People who bought X also bought Y"
 * 
 * This analyzes receipt_lines to find items frequently purchased together
 */
export async function GET(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized GET /api/analytics/item-associations`);
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
    const minConfidence = parseFloat(searchParams.get("min_confidence") || "0.1"); // 10% minimum
    const minFrequency = parseInt(searchParams.get("min_frequency") || "3"); // At least 3 times

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get the last 90 days of completed receipts
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Query to find item pairs that appear together in receipts
    // This is a complex query that finds co-occurrences
    const { data: associations, error } = await supabase.rpc(
      'calculate_item_associations',
      {
        p_org_id: orgId,
        p_days_back: 90,
        p_min_frequency: minFrequency,
        p_min_confidence: minConfidence
      }
    );

    if (error) {
      console.error("Error calculating associations:", error);
      
      // Fallback: Return empty array if function doesn't exist yet
      if (error.message?.includes('function') && error.message?.includes('does not exist')) {
        console.warn("[ItemAssociations] Database function not yet created, returning empty");
        return NextResponse.json([]);
      }
      
      return NextResponse.json(
        { error: "Failed to calculate associations" },
        { status: 500 }
      );
    }

    console.log(`[ItemAssociations] Found ${associations?.length || 0} associations for org ${orgId}`);
    
    return NextResponse.json(associations || []);
  } catch (error) {
    console.error("Error in item associations API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
