import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized GET /api/reports/upsells`);
    return unauthorizedResponse();
  }

  // ✅ SECURITY: Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("org_id");
    const days = parseInt(searchParams.get("days") || "30");

    // ✅ SECURITY: Verify org_id matches session
    if (!orgId || orgId !== session.org_id) {
      console.warn(`[API-AUTH] Org mismatch - Request: ${orgId}, Session: ${session.org_id}`);
      return unauthorizedResponse();
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get upsell analytics for the period
    const { data: analytics, error: analyticsError } = await supabase
      .from("upsell_analytics")
      .select("*")
      .eq("org_id", orgId)
      .gte("created_at", startDate.toISOString());

    if (analyticsError) {
      console.error("[Upsells API] Error fetching analytics:", analyticsError);
      return NextResponse.json({ error: "Failed to fetch upsell data" }, { status: 500 });
    }

    // Calculate statistics
    const stats = {
      total_shown: (analytics as any[]).filter((a: any) => a.action === 'shown').length,
      total_accepted: (analytics as any[]).filter((a: any) => a.action === 'accepted').length,
      total_dismissed: (analytics as any[]).filter((a: any) => a.action === 'dismissed').length,
      total_auto_dismissed: (analytics as any[]).filter((a: any) => a.action === 'auto_dismissed').length,
      acceptance_rate: 0,
      top_accepted_items: [] as any[],
      revenue_from_upsells: 0
    };

    // Calculate acceptance rate
    if (stats.total_shown > 0) {
      stats.acceptance_rate = (stats.total_accepted / stats.total_shown) * 100;
    }

    // Get top accepted items
    const acceptedItems = (analytics as any[]).filter((a: any) => a.action === 'accepted');
    const itemCounts = acceptedItems.reduce((acc: any, item) => {
      const key = item.suggested_item_id || item.suggested_item_name;
      if (!acc[key]) {
        acc[key] = {
          item_id: item.suggested_item_id,
          item_name: item.suggested_item_name,
          count: 0
        };
      }
      acc[key].count++;
      return acc;
    }, {});

    stats.top_accepted_items = Object.values(itemCounts)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 5);

    // Get revenue from upsells (items that were accepted and have receipt_id)
    const acceptedWithReceipts = acceptedItems.filter(a => a.receipt_id);
    
    if (acceptedWithReceipts.length > 0) {
      const receiptIds = [...new Set(acceptedWithReceipts.map(a => a.receipt_id))];
      
      // Get receipt lines for these receipts and suggested items
      const { data: receiptLines } = await supabase
        .from("receipt_lines")
        .select("total, item_id")
        .in("receipt_id", receiptIds);

      if (receiptLines) {
        // Match receipt lines with accepted upsells
        const upsellRevenue = (receiptLines as any[])
          .filter((line: any) => 
            acceptedWithReceipts.some((a: any) => a.suggested_item_id === line.item_id)
          )
          .reduce((sum, line: any) => sum + parseFloat(line.total || "0"), 0);
        
        stats.revenue_from_upsells = upsellRevenue;
      }
    }

    return NextResponse.json({
      stats,
      analytics: (analytics as any[]).slice(0, 100) // Return last 100 for detailed view
    });
  } catch (error) {
    console.error("[Upsells API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch upsell data" },
      { status: 500 }
    );
  }
}
