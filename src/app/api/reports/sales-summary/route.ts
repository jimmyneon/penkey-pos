export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized GET /api/reports/sales-summary`);
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
    const memberId = searchParams.get("member_id");

    // ✅ SECURITY: Verify org_id matches session
    if (!orgId || orgId !== session.org_id) {
      console.warn(`[API-AUTH] Org mismatch - Request: ${orgId}, Session: ${session.org_id}`);
      return unauthorizedResponse();
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get member info for name
    let userName = "there";
    if (memberId) {
      const { data: member } = await supabase
        .from("org_members")
        .select("first_name, last_name, display_name")
        .eq("id", memberId)
        .single();
      
      if (member) {
        userName = (member as any).first_name || (member as any).display_name || "there";
      }
    }

    // Get date range from query params (default to last 30 days)
    const daysBack = parseInt(searchParams.get("days") || "30");
    const customStartDate = searchParams.get("start_date");
    const customEndDate = searchParams.get("end_date");
    
    let startDate: Date;
    let endDate: Date;
    
    if (customStartDate && customEndDate) {
      // Use custom date range
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
      endDate.setHours(23, 59, 59, 999);
      console.log(`[Sales Summary] Fetching receipts from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    } else {
      // Use days-based range
      startDate = new Date();
      startDate.setDate(startDate.getDate() - (daysBack - 1));
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      console.log(`[Sales Summary] Fetching receipts for last ${daysBack} days, from ${startDate.toISOString()}`);
    }

    // Fetch receipts with pagination (Supabase free tier has 1000 row limit)
    let allReceipts: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: pageReceipts, error: receiptsError } = await supabase
        .from("receipts")
        .select("id, total, subtotal, tax_total, discount_total, member_id, created_at")
        .eq("org_id", orgId)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .neq("status", "fully_refunded")  // Exclude refunded receipts
        .neq("status", "voided")  // Exclude voided receipts
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (receiptsError) {
        console.error("[Sales Summary] Error fetching receipts:", receiptsError);
        break;
      }

      if (pageReceipts && pageReceipts.length > 0) {
        allReceipts = allReceipts.concat(pageReceipts);
        console.log(`[Sales Summary] Fetched page ${page + 1}: ${pageReceipts.length} receipts`);
        
        // If we got less than pageSize, we've reached the end
        if (pageReceipts.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    const receipts = allReceipts;
    console.log(`[Sales Summary] Total receipts fetched: ${receipts.length}`);
    if (receipts.length > 0) {
      console.log(`[Sales Summary] Date range: ${receipts[receipts.length - 1].created_at} to ${receipts[0].created_at}`);
    }

    // Fetch refunds
    const { data: refunds } = await supabase
      .from("refunds")
      .select("id, amount, created_at")
      .eq("org_id", orgId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    // Get employees for the org
    const { data: employees } = await supabase
      .from("org_members")
      .select("id, first_name, last_name, display_name")
      .eq("org_id", orgId)
      .order("first_name");

    // Calculate metrics
    const grossSales = receipts?.reduce((sum: number, r: any) => sum + parseFloat(r.total || "0"), 0) || 0;
    const refundsTotal = refunds?.reduce((sum: number, r: any) => sum + parseFloat(r.amount || "0"), 0) || 0;
    const discountsTotal = receipts?.reduce((sum: number, r: any) => sum + parseFloat(r.discount_total || "0"), 0) || 0;

    return NextResponse.json({
      userName,
      salesData: {
        grossSales,
        refunds: refundsTotal,
        discounts: discountsTotal,
        netSales: grossSales - refundsTotal - discountsTotal,
        receipts: receipts || [],
        refundsList: refunds || [],
      },
      employees: employees || [],
    });
  } catch (error: any) {
    console.error("Failed to fetch sales summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales summary" },
      { status: 500 }
    );
  }
}
