export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const orgId = searchParams.get("org_id");
    const days = parseInt(searchParams.get("days") || "1");
    const memberId = searchParams.get("member_id");

    if (!orgId || orgId !== session.org_id) {
      return unauthorizedResponse();
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Calculate date range (inclusive of today)
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (days - 1));
    const startDateStr = startDate.toISOString();

    // 1. Fetch receipts for the period
    let receiptQuery = supabase
      .from("receipts")
      .select("id, total, created_at")
      .eq("org_id", orgId)
      .gte("created_at", startDateStr)
      .neq("status", "voided")
      .neq("status", "fully_refunded");

    if (memberId) {
      receiptQuery = receiptQuery.eq("member_id", memberId);
    }

    const { data: receipts, error: receiptsError } = await receiptQuery as any;

    if (receiptsError) {
      console.error("[Staff Targets] Error fetching receipts:", receiptsError);
    }

    const ticketCount = (receipts as any[])?.length || 0;

    // 2. Fetch upsell analytics (accepted upsells)
    let upsellQuery = supabase
      .from("upsell_analytics")
      .select("id")
      .eq("org_id", orgId)
      .eq("action", "accepted")
      .gte("created_at", startDateStr);

    if (memberId) {
      upsellQuery = upsellQuery.eq("member_id", memberId);
    }

    const { data: upsells, error: upsellsError } = await upsellQuery;

    if (upsellsError) {
      console.error("[Staff Targets] Error fetching upsells:", upsellsError);
    }

    const upsellCount = upsells?.length || 0;

    // 3. Calculate wet mix percentage (tickets with food vs total)
    let wetMixPercentage = 0;
    if (receipts && receipts.length > 0) {
      const receiptIds = (receipts as any[])?.map((r: any) => r.id) || [];

      // Get receipt lines with item categories to determine wet vs dry
      // Paginate to avoid Supabase 1000 row limit
      let allLines: Array<{ receipt_id: string; item_id: string | null; quantity: number }> = [];
      const pageSize = 1000;
      let offset = 0;

      while (offset < receiptIds.length * 10) {
        const batchIds = receiptIds.slice(offset, offset + pageSize);
        if (batchIds.length === 0) break;

        const { data: lines, error: linesError } = await supabase
          .from("receipt_lines")
          .select("receipt_id, item_id, quantity")
          .in("receipt_id", batchIds)
          .limit(pageSize);

        if (linesError || !lines || lines.length === 0) break;
        allLines.push(...(lines as Array<{ receipt_id: string; item_id: string | null; quantity: number }>));
        if (lines.length < pageSize) break;
        offset += pageSize;
      }

      // Get categories for items
      const itemIds = Array.from(new Set(allLines.map(l => l.item_id).filter(Boolean))) as string[];
      const foodCategoryKeywords = ['food', 'sandwich', 'lunch', 'breakfast', 'salad', 'wrap', 'panini', 'toastie', 'bakery', 'cake', 'pastry', 'dessert', 'savoury', 'snack'];

      let foodItemIds = new Set<string>();

      if (itemIds.length > 0) {
        // Fetch items with their categories
        for (let i = 0; i < itemIds.length; i += 500) {
          const batch = itemIds.slice(i, i + 500);
          const { data: items } = await supabase
            .from("items")
            .select("id, category_id")
            .in("id", batch);

          if (items) {
            const categoryIds = Array.from(new Set(items.map((it: any) => it.category_id).filter(Boolean))) as string[];
            if (categoryIds.length > 0) {
              const { data: categories } = await supabase
                .from("categories")
                .select("id, name")
                .in("id", categoryIds);

              if (categories) {
                const foodCategoryIds = new Set<string>(
                  categories
                    .filter((c: any) => {
                      const name = (c.name || '').toLowerCase();
                      return foodCategoryKeywords.some(kw => name.includes(kw));
                    })
                    .map((c: any) => c.id)
                );

                items.forEach((it: any) => {
                  if (it.category_id && foodCategoryIds.has(it.category_id)) {
                    foodItemIds.add(it.id);
                  }
                });
              }
            }
          }
        }
      }

      // Count receipts that have at least one food item
      const receiptsByFood = new Map<string, boolean>();
      allLines.forEach(line => {
        if (line.item_id && foodItemIds.has(line.item_id)) {
          receiptsByFood.set(line.receipt_id, true);
        }
      });

      const wetCount = receiptsByFood.size;
      wetMixPercentage = ticketCount > 0 ? Math.round((wetCount / ticketCount) * 100) : 0;
    }

    // 4. Fetch QR scan count (review mentions proxy)
    const { count: reviewScans, error: qrError } = await supabase
      .from("qr_scans")
      .select("id", { count: "exact", head: true })
      .gte("scanned_at", startDateStr);

    if (qrError) {
      console.error("[Staff Targets] Error fetching QR scans:", qrError);
    }

    return NextResponse.json({
      upsellCount,
      wetMixPercentage,
      ticketCount,
      reviewMentions: reviewScans || 0,
    });
  } catch (error) {
    console.error("Error in staff targets API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
