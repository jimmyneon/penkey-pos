export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";
import { classifyCategoryType } from "@/lib/utils/category-classification";

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

    // Helper function to categorize item based on category type, falling back to name
    const categorizeItem = (categoryType: string | null, categoryName: string | null): 'drink' | 'food' | 'other' => {
      const type = (categoryType || "other").toLowerCase();
      if (type === "drink") return "drink";
      if (type === "food") return "food";
      // Fallback to name-based classification when type is 'other' or missing
      if (type === "other" && categoryName) {
        const inferred = classifyCategoryType(categoryName);
        if (inferred === "drink") return "drink";
        if (inferred === "food") return "food";
      }
      return "other";
    };

    console.log(`[Drink/Food Split] Fetched ${receiptLines?.length || 0} receipt lines`);

    // Group by receipt and categorize
    const receiptMap = new Map<string, { hasDrink: boolean; hasFood: boolean; total: number }>();

    (receiptLines || []).forEach((line: any) => {
      const receiptId = line.receipt_id;
      const categoryType = line.items?.categories?.type || 'other';
      // Fallback to the item/category name, then the receipt line name itself
      const categoryName = line.items?.categories?.name || line.items?.name || line.name || null;
      const category = categorizeItem(categoryType, categoryName);
      const lineTotal = parseFloat(line.line_total || "0");

      if (!receiptMap.has(receiptId)) {
        receiptMap.set(receiptId, { hasDrink: false, hasFood: false, total: 0 });
      }

      const receipt = receiptMap.get(receiptId)!;
      receipt.total += lineTotal;

      if (category === 'drink') receipt.hasDrink = true;
      if (category === 'food') receipt.hasFood = true;
    });

    console.log(`[Drink/Food Split] Processed ${receiptMap.size} unique receipts`);

    // Calculate statistics
    let drinksOnlyCount = 0;
    let foodOnlyCount = 0;
    let bothCount = 0;
    let otherOnlyCount = 0;
    let drinksOnlyRevenue = 0;
    let foodOnlyRevenue = 0;
    let bothRevenue = 0;
    let otherOnlyRevenue = 0;

    receiptMap.forEach((data) => {
      if (data.hasDrink && !data.hasFood) {
        drinksOnlyCount++;
        drinksOnlyRevenue += data.total;
      } else if (data.hasFood && !data.hasDrink) {
        foodOnlyCount++;
        foodOnlyRevenue += data.total;
      } else if (data.hasDrink && data.hasFood) {
        bothCount++;
        bothRevenue += data.total;
      } else {
        otherOnlyCount++;
        otherOnlyRevenue += data.total;
      }
    });

    const totalReceipts = receiptMap.size;
    const totalRevenue = drinksOnlyRevenue + foodOnlyRevenue + bothRevenue + otherOnlyRevenue;

    return NextResponse.json({
      summary: {
        total_receipts: totalReceipts,
        total_revenue: totalRevenue,
        drinks_only: {
          count: drinksOnlyCount,
          revenue: drinksOnlyRevenue,
          percentage: totalReceipts > 0 ? (drinksOnlyCount / totalReceipts) * 100 : 0,
        },
        food_only: {
          count: foodOnlyCount,
          revenue: foodOnlyRevenue,
          percentage: totalReceipts > 0 ? (foodOnlyCount / totalReceipts) * 100 : 0,
        },
        both: {
          count: bothCount,
          revenue: bothRevenue,
          percentage: totalReceipts > 0 ? (bothCount / totalReceipts) * 100 : 0,
        },
        other_only: {
          count: otherOnlyCount,
          revenue: otherOnlyRevenue,
          percentage: totalReceipts > 0 ? (otherOnlyCount / totalReceipts) * 100 : 0,
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
