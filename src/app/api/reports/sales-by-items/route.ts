export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized GET /api/reports/sales-by-items`);
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

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    console.log(`[Sales by Items] Fetching for last ${days} days, from ${startDate.toISOString()}`);

    // Fetch receipt lines with item details
    const { data: receiptLines, error: linesError } = await supabase
      .from("receipt_lines")
      .select(`
        id,
        item_id,
        variant_id,
        name,
        quantity,
        unit_price,
        discount_amount,
        tax_rate,
        tax_amount,
        line_total,
        receipt_id,
        receipts!inner (
          created_at,
          org_id
        )
      `)
      .eq("receipts.org_id", orgId)
      .gte("receipts.created_at", startDate.toISOString());

    if (linesError) {
      console.error("[Sales by Items] Error fetching receipt lines:", linesError);
      return NextResponse.json({ error: "Failed to fetch item sales data" }, { status: 500 });
    }

    // Aggregate data by item
    const itemMap = new Map();

    (receiptLines || []).forEach((line: any) => {
      const key = line.item_id || line.name;
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          item_id: line.item_id,
          name: line.name,
          quantity_sold: 0,
          total_revenue: 0,
          total_tax: 0,
          total_discount: 0,
          avg_price: 0,
          transaction_count: 0,
        });
      }

      const item = itemMap.get(key);
      item.quantity_sold += line.quantity;
      item.total_revenue += parseFloat(line.line_total || "0");
      item.total_tax += parseFloat(line.tax_amount || "0");
      item.total_discount += parseFloat(line.discount_amount || "0");
      item.transaction_count += 1;
    });

    // Calculate averages and convert to array
    const items = Array.from(itemMap.values()).map(item => ({
      ...item,
      avg_price: item.quantity_sold > 0 ? item.total_revenue / item.quantity_sold : 0,
    }));

    // Sort by quantity sold (descending)
    items.sort((a, b) => b.quantity_sold - a.quantity_sold);

    // Calculate totals
    const totalItems = items.length;
    const totalQuantitySold = items.reduce((sum, item) => sum + item.quantity_sold, 0);
    const totalRevenue = items.reduce((sum, item) => sum + item.total_revenue, 0);

    return NextResponse.json({
      items,
      summary: {
        total_items: totalItems,
        total_quantity_sold: totalQuantitySold,
        total_revenue: totalRevenue,
        top_selling_item: items.length > 0 ? items[0] : null,
      },
    });
  } catch (error: any) {
    console.error("[Sales by Items] Failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales by items" },
      { status: 500 }
    );
  }
}
