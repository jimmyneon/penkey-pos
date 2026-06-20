export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";
import { classifyCategoryType, classifyFoodSubtype } from "@/lib/utils/category-classification";

export async function GET(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized GET /api/reports/drink-food-split`);
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
    const days = parseInt(searchParams.get("days") || "30");

    // ✅ SECURITY: Verify org_id matches session
    if (!orgId || orgId !== session.org_id) {
      console.warn(`[API-AUTH] Org mismatch - Request: ${orgId}, Session: ${session.org_id}`);
      return unauthorizedResponse();
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const customStartDate = searchParams.get("start_date");
    const customEndDate = searchParams.get("end_date");
    
    let startDate: Date;
    let endDate: Date;
    
    if (customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
      endDate.setHours(23, 59, 59, 999);
      console.log(`[Drink/Food Split] Fetching from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - (days - 1));
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      console.log(`[Drink/Food Split] Fetching for last ${days} days, from ${startDate.toISOString()}`);
    }

    // Fetch receipt lines with item and category details (left join so we keep all lines)
    // Paginate because Supabase REST API caps at 1000 rows per request.
    const pageSize = 1000;
    let allReceiptLines: any[] = [];
    let page = 0;
    let fetchedPageSize = pageSize;

    while (fetchedPageSize === pageSize) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data: receiptLinesPage, error: linesError } = await supabase
        .from("receipt_lines")
        .select(`
          id,
          item_id,
          name,
          quantity,
          unit_price,
          line_total,
          receipt_id,
          items!left (
            category_id,
            categories!left (
              name,
              type
            )
          ),
          receipts!inner (
            created_at,
            org_id,
            status
          )
        `)
        .eq("receipts.org_id", orgId)
        .gte("receipts.created_at", startDate.toISOString())
        .lte("receipts.created_at", endDate.toISOString())
        .neq("receipts.status", "fully_refunded")
        .neq("receipts.status", "voided")
        .order("receipt_id")
        .range(from, to);

      if (linesError) {
        console.error("[Drink/Food Split] Error fetching receipt lines:", linesError);
        return NextResponse.json({ error: "Failed to fetch receipt data" }, { status: 500 });
      }

      fetchedPageSize = receiptLinesPage?.length || 0;
      if (fetchedPageSize > 0) {
        allReceiptLines = allReceiptLines.concat(receiptLinesPage);
      }
      page++;

      // Safety guard: never exceed 100 pages (100k lines)
      if (page > 100) {
        console.warn("[Drink/Food Split] Hit pagination safety limit");
        break;
      }
    }

    const receiptLines = allReceiptLines;

    // Helper function to categorize item into drink / sweet / lunch / other
    const categorizeItem = (categoryType: string | null, categoryName: string | null): 'drink' | 'sweet' | 'lunch' | 'other' => {
      const type = (categoryType || "other").toLowerCase();
      if (type === "drink") return "drink";
      if (type === "food") {
        // Use the name to determine if it's a sweet treat or proper lunch
        const sub = classifyFoodSubtype(categoryName || "");
        if (sub === "sweet") return "sweet";
        if (sub === "lunch") return "lunch";
        return "other";
      }
      // Fallback to name-based classification when type is 'other' or missing
      if (type === "other" && categoryName) {
        const inferred = classifyCategoryType(categoryName);
        if (inferred === "drink") return "drink";
        if (inferred === "food") {
          const sub = classifyFoodSubtype(categoryName);
          if (sub === "sweet") return "sweet";
          if (sub === "lunch") return "lunch";
          return "other";
        }
      }
      return "other";
    };

    console.log(`[Drink/Food Split] Fetched ${receiptLines?.length || 0} receipt lines`);

    // Group by receipt and categorize
    const receiptMap = new Map<string, { hasDrink: boolean; hasSweet: boolean; hasLunch: boolean; total: number }>();

    (receiptLines || []).forEach((line: any) => {
      const receiptId = line.receipt_id;
      const categoryType = line.items?.categories?.type || 'other';
      // Fallback to the item/category name, then the receipt line name itself
      const categoryName = line.items?.categories?.name || line.items?.name || line.name || null;
      const category = categorizeItem(categoryType, categoryName);
      const lineTotal = parseFloat(line.line_total || "0");

      if (!receiptMap.has(receiptId)) {
        receiptMap.set(receiptId, { hasDrink: false, hasSweet: false, hasLunch: false, total: 0 });
      }

      const receipt = receiptMap.get(receiptId)!;
      receipt.total += lineTotal;

      if (category === 'drink') receipt.hasDrink = true;
      if (category === 'sweet') receipt.hasSweet = true;
      if (category === 'lunch') receipt.hasLunch = true;
    });

    console.log(`[Drink/Food Split] Processed ${receiptMap.size} unique receipts`);

    // Calculate statistics — track all meaningful combinations
    const stats = {
      drinks_only: { count: 0, revenue: 0 },
      drinks_sweet: { count: 0, revenue: 0 },
      drinks_lunch: { count: 0, revenue: 0 },
      drinks_both_food: { count: 0, revenue: 0 },
      sweet_only: { count: 0, revenue: 0 },
      lunch_only: { count: 0, revenue: 0 },
      both_food_only: { count: 0, revenue: 0 },
      other: { count: 0, revenue: 0 },
    };

    receiptMap.forEach((data) => {
      const hasFood = data.hasSweet || data.hasLunch;
      const bucket = (() => {
        if (data.hasDrink && !hasFood) return 'drinks_only';
        if (data.hasDrink && data.hasSweet && !data.hasLunch) return 'drinks_sweet';
        if (data.hasDrink && data.hasLunch && !data.hasSweet) return 'drinks_lunch';
        if (data.hasDrink && data.hasSweet && data.hasLunch) return 'drinks_both_food';
        if (!data.hasDrink && data.hasSweet && !data.hasLunch) return 'sweet_only';
        if (!data.hasDrink && data.hasLunch && !data.hasSweet) return 'lunch_only';
        if (!data.hasDrink && data.hasSweet && data.hasLunch) return 'both_food_only';
        return 'other';
      })();

      stats[bucket].count++;
      stats[bucket].revenue += data.total;
    });

    const totalReceipts = receiptMap.size;
    const totalRevenue = Object.values(stats).reduce((sum, s) => sum + s.revenue, 0);
    const pct = (n: number) => totalReceipts > 0 ? (n / totalReceipts) * 100 : 0;

    // Also compute aggregate "wet vs dry" for the card summary
    const drinksOnlyCount = stats.drinks_only.count;
    const wetCount = totalReceipts - stats.drinks_only.count - stats.other.count;

    return NextResponse.json({
      summary: {
        total_receipts: totalReceipts,
        total_revenue: totalRevenue,
        // Aggregate wet vs dry for the card
        drinks_only: {
          count: drinksOnlyCount,
          revenue: stats.drinks_only.revenue,
          percentage: pct(drinksOnlyCount),
        },
        wet: {
          count: wetCount,
          revenue: totalRevenue - stats.drinks_only.revenue - stats.other.revenue,
          percentage: pct(wetCount),
        },
        other_only: {
          count: stats.other.count,
          revenue: stats.other.revenue,
          percentage: pct(stats.other.count),
        },
        // Detailed breakdown for the modal
        breakdown: {
          drinks_only: { count: stats.drinks_only.count, revenue: stats.drinks_only.revenue, percentage: pct(stats.drinks_only.count) },
          drinks_sweet: { count: stats.drinks_sweet.count, revenue: stats.drinks_sweet.revenue, percentage: pct(stats.drinks_sweet.count) },
          drinks_lunch: { count: stats.drinks_lunch.count, revenue: stats.drinks_lunch.revenue, percentage: pct(stats.drinks_lunch.count) },
          drinks_both_food: { count: stats.drinks_both_food.count, revenue: stats.drinks_both_food.revenue, percentage: pct(stats.drinks_both_food.count) },
          sweet_only: { count: stats.sweet_only.count, revenue: stats.sweet_only.revenue, percentage: pct(stats.sweet_only.count) },
          lunch_only: { count: stats.lunch_only.count, revenue: stats.lunch_only.revenue, percentage: pct(stats.lunch_only.count) },
          both_food_only: { count: stats.both_food_only.count, revenue: stats.both_food_only.revenue, percentage: pct(stats.both_food_only.count) },
          other: { count: stats.other.count, revenue: stats.other.revenue, percentage: pct(stats.other.count) },
        },
      },
    });
  } catch (error: any) {
    console.error("[Drink/Food Split] Failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch drink/food split data" },
      { status: 500 }
    );
  }
}
