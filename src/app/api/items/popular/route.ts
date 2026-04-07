export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

/**
 * Get popular items based on sales data
 * Time-aware: Returns different items based on time of day
 */
export async function GET(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized GET /api/items/popular`);
    return unauthorizedResponse();
  }

  // ✅ SECURITY: Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("org_id");
    const limit = parseInt(searchParams.get("limit") || "20");

    // ✅ SECURITY: Verify org_id matches session
    if (!orgId || orgId !== session.org_id) {
      console.warn(`[API-AUTH] Org mismatch - Request: ${orgId}, Session: ${session.org_id}`);
      return unauthorizedResponse();
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Determine current time segment
    const now = new Date();
    const hour = now.getHours();
    let timeSegment: { start: number; end: number };

    if (hour >= 6 && hour < 11) {
      // Breakfast: 6am-11am
      timeSegment = { start: 6, end: 11 };
    } else if (hour >= 11 && hour < 15) {
      // Lunch: 11am-3pm
      timeSegment = { start: 11, end: 15 };
    } else if (hour >= 15 && hour < 21) {
      // Dinner: 3pm-9pm
      timeSegment = { start: 15, end: 21 };
    } else {
      // Late night: 9pm-6am
      timeSegment = { start: 21, end: 6 };
    }

    // Query to get popular items based on sales data
    // Using raw SQL for complex aggregation with time filtering
    const { data: popularItems, error } = await supabase.rpc(
      "get_popular_items",
      {
        p_org_id: orgId,
        p_hour_start: timeSegment.start,
        p_hour_end: timeSegment.end,
        p_days_back: 30,
        p_limit: limit,
      }
    );

    if (error) {
      // If function doesn't exist yet, fall back to simpler query
      console.log("[Popular Items] RPC function not found, using fallback query");
      
      // Fallback: Get most sold items in last 30 days (no time filtering)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: receiptLines, error: fallbackError } = await supabase
        .from("receipt_lines")
        .select(`
          item_id,
          variant_id,
          quantity,
          items!inner(
            id,
            name,
            image_url,
            base_price,
            has_variants,
            category_id,
            is_active,
            categories(name, color),
            item_variants(id, name, price, is_default)
          )
        `)
        .eq("org_id", orgId)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .eq("items.is_active", true);

      if (fallbackError) throw fallbackError;

      // Aggregate by item_id
      const itemSales = new Map<string, { item: any; totalQuantity: number }>();
      
      receiptLines?.forEach((line: any) => {
        const itemId = line.item_id;
        if (!itemSales.has(itemId)) {
          itemSales.set(itemId, {
            item: line.items,
            totalQuantity: 0,
          });
        }
        const current = itemSales.get(itemId)!;
        current.totalQuantity += parseFloat(line.quantity);
      });

      // Sort by quantity and take top items
      const sortedItems = Array.from(itemSales.values())
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, limit)
        .map((entry) => entry.item);

      return NextResponse.json(sortedItems);
    }

    // If RPC function exists, format the results
    const formattedItems = await Promise.all(
      popularItems.map(async (item: any) => {
        const { data: fullItem } = await supabase
          .from("items")
          .select(`
            *,
            categories(name, color),
            item_variants(id, name, price, is_default)
          `)
          .eq("id", item.item_id)
          .eq("is_active", true)
          .single();

        return fullItem;
      })
    );

    // Filter out nulls (items that may have been deactivated)
    const activeItems = formattedItems.filter((item) => item !== null);

    return NextResponse.json(activeItems);
  } catch (error: any) {
    console.error("Failed to fetch popular items:", error);
    return NextResponse.json(
      { error: "Failed to fetch popular items", details: error.message },
      { status: 500 }
    );
  }
}
