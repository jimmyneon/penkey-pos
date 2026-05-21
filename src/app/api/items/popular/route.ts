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
      
      // Fallback: Use weighted scoring (70% recent + 30% all-time)
      // This picks up changes quickly while still respecting historical data
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Get ALL active items first
      const { data: allItems, error: itemsError } = await supabase
        .from("items")
        .select(`
          id,
          name,
          image_url,
          base_price,
          has_variants,
          category_id,
          is_active,
          categories(name, color),
          item_variants(id, name, price, is_default)
        `)
        .eq("org_id", orgId)
        .eq("is_active", true);

      if (itemsError) throw itemsError;

      // Get recent sales (last 7 days)
      const { data: recentLines, error: recentError } = await supabase
        .from("receipt_lines")
        .select("item_id, name, quantity, receipts!inner(created_at, status)")
        .eq("org_id", orgId)
        .gte("receipts.created_at", sevenDaysAgo.toISOString())
        .neq("receipts.status", "fully_refunded")
        .neq("receipts.status", "voided");

      if (recentError) throw recentError;

      // Get all-time sales
      const { data: allTimeLines, error: allTimeError } = await supabase
        .from("receipt_lines")
        .select("item_id, name, quantity, receipts!inner(status)")
        .eq("org_id", orgId)
        .neq("receipts.status", "fully_refunded")
        .neq("receipts.status", "voided");

      if (allTimeError) throw allTimeError;

      // Calculate scores for each item
      const itemScores = new Map<string, { item: any; score: number; recentQty: number; allTimeQty: number }>();

      // Initialize with all active items
      allItems?.forEach((item: any) => {
        itemScores.set(item.id, {
          item,
          score: 0,
          recentQty: 0,
          allTimeQty: 0,
        });
      });

      // Count recent sales (by item_id OR name matching)
      recentLines?.forEach((line: any) => {
        const qty = parseFloat(line.quantity || 0);
        
        // Try to match by item_id first
        if (line.item_id && itemScores.has(line.item_id)) {
          const entry = itemScores.get(line.item_id)!;
          entry.recentQty += qty;
        } else if (line.name) {
          // Match by name for historical items (case-insensitive)
          const matchingItem = allItems?.find((item: any) => 
            item.name.toLowerCase() === line.name.toLowerCase()
          );
          if (matchingItem && itemScores.has(matchingItem.id)) {
            const entry = itemScores.get(matchingItem.id)!;
            entry.recentQty += qty;
          }
        }
      });

      // Count all-time sales (by item_id OR name matching)
      allTimeLines?.forEach((line: any) => {
        const qty = parseFloat(line.quantity || 0);
        
        // Try to match by item_id first
        if (line.item_id && itemScores.has(line.item_id)) {
          const entry = itemScores.get(line.item_id)!;
          entry.allTimeQty += qty;
        } else if (line.name) {
          // Match by name for historical items (case-insensitive)
          const matchingItem = allItems?.find((item: any) => 
            item.name.toLowerCase() === line.name.toLowerCase()
          );
          if (matchingItem && itemScores.has(matchingItem.id)) {
            const entry = itemScores.get(matchingItem.id)!;
            entry.allTimeQty += qty;
          }
        }
      });

      // Calculate weighted score: 70% recent + 30% all-time
      itemScores.forEach((entry) => {
        entry.score = (entry.recentQty * 0.7) + (entry.allTimeQty * 0.3);
      });

      // Sort by score and take top items
      const sortedItems = Array.from(itemScores.values())
        .filter((entry) => entry.score > 0) // Only include items with sales
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((entry) => entry.item);

      console.log(`[Popular Items] Calculated ${sortedItems.length} items with weighted scores`);
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
