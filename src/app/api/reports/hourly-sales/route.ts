export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized GET /api/reports/hourly-sales`);
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
    // For days=1 (today), we want 0 days back. For days=7, we want 6 days back, etc.
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    console.log(`[Hourly Sales] Fetching for last ${days} days, from ${startDate.toISOString()}`);

    // Fetch receipts (excluding refunded/voided)
    const { data: receipts, error: receiptsError } = await supabase
      .from("receipts")
      .select("id, total, created_at")
      .eq("org_id", orgId)
      .gte("created_at", startDate.toISOString())
      .neq("status", "fully_refunded")
      .neq("status", "voided");

    if (receiptsError) {
      console.error("[Hourly Sales] Error fetching receipts:", receiptsError);
      return NextResponse.json({ error: "Failed to fetch hourly sales data" }, { status: 500 });
    }

    // Initialize hourly buckets (0-23)
    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      total_sales: 0,
      transaction_count: 0,
      avg_transaction: 0,
    }));

    // Aggregate by hour
    (receipts || []).forEach((receipt: any) => {
      const hour = new Date(receipt.created_at).getHours();
      const bucket = hourlyData[hour];
      bucket.total_sales += parseFloat(receipt.total || "0");
      bucket.transaction_count += 1;
    });

    // Calculate averages
    hourlyData.forEach(bucket => {
      bucket.avg_transaction = bucket.transaction_count > 0 
        ? bucket.total_sales / bucket.transaction_count 
        : 0;
    });

    // Find peak hours
    const peakHours = hourlyData
      .filter(h => h.transaction_count > 0)
      .sort((a, b) => b.total_sales - a.total_sales)
      .slice(0, 3);

    // Calculate totals
    const totalSales = hourlyData.reduce((sum, h) => sum + h.total_sales, 0);
    const totalTransactions = hourlyData.reduce((sum, h) => sum + h.transaction_count, 0);

    return NextResponse.json({
      hourly_data: hourlyData,
      summary: {
        total_sales: totalSales,
        total_transactions: totalTransactions,
        peak_hours: peakHours,
        busiest_hour: peakHours.length > 0 ? peakHours[0].hour : null,
      },
    });
  } catch (error: any) {
    console.error("[Hourly Sales] Failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch hourly sales" },
      { status: 500 }
    );
  }
}
