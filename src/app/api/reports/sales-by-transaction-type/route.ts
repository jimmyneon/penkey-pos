export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized GET /api/reports/sales-by-transaction-type`);
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
      console.log(`[Sales by Transaction Type] Fetching from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - (days - 1));
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      console.log(`[Sales by Transaction Type] Fetching for last ${days} days, from ${startDate.toISOString()}`);
    }

    // Fetch payments with receipt details (excluding refunded/voided)
    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select(`
        id,
        method,
        amount,
        tip_amount,
        metadata,
        receipt_id,
        receipts!inner (
          created_at,
          org_id,
          total,
          status
        )
      `)
      .eq("receipts.org_id", orgId)
      .gte("receipts.created_at", startDate.toISOString())
      .lte("receipts.created_at", endDate.toISOString())
      .neq("receipts.status", "fully_refunded")
      .neq("receipts.status", "voided");

    if (paymentsError) {
      console.error("[Sales by Transaction Type] Error fetching payments:", paymentsError);
      return NextResponse.json({ error: "Failed to fetch transaction type data" }, { status: 500 });
    }

    // Aggregate by payment method
    const methodMap = new Map();

    (payments || []).forEach((payment: any) => {
      const method = payment.method || "unknown";
      if (!methodMap.has(method)) {
        methodMap.set(method, {
          method,
          total_amount: 0,
          total_tips: 0,
          transaction_count: 0,
          avg_transaction: 0,
          providers: {},
        });
      }

      const data = methodMap.get(method);
      data.total_amount += parseFloat(payment.amount || "0");
      data.total_tips += parseFloat(payment.tip_amount || "0");
      data.transaction_count += 1;

      // Track providers (e.g., SumUp for card payments)
      if (payment.metadata?.payment_provider) {
        const provider = payment.metadata.payment_provider;
        if (!data.providers[provider]) {
          data.providers[provider] = {
            amount: 0,
            count: 0,
          };
        }
        data.providers[provider].amount += parseFloat(payment.amount || "0");
        data.providers[provider].count += 1;
      }
    });

    // Calculate averages and convert to array
    const transactionTypes = Array.from(methodMap.values()).map(type => ({
      ...type,
      avg_transaction: type.transaction_count > 0 ? type.total_amount / type.transaction_count : 0,
    }));

    // Sort by total amount (descending)
    transactionTypes.sort((a, b) => b.total_amount - a.total_amount);

    // Calculate totals
    const totalRevenue = transactionTypes.reduce((sum, type) => sum + type.total_amount, 0);
    const totalTips = transactionTypes.reduce((sum, type) => sum + type.total_tips, 0);
    const totalTransactions = transactionTypes.reduce((sum, type) => sum + type.transaction_count, 0);

    return NextResponse.json({
      transaction_types: transactionTypes,
      summary: {
        total_revenue: totalRevenue,
        total_tips: totalTips,
        total_transactions: totalTransactions,
        most_common_method: transactionTypes.length > 0 ? transactionTypes[0].method : null,
      },
    });
  } catch (error: any) {
    console.error("[Sales by Transaction Type] Failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales by transaction type" },
      { status: 500 }
    );
  }
}
