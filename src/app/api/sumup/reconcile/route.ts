export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function POST(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized POST /api/sumup/reconcile`);
    return unauthorizedResponse();
  }

  // ✅ SECURITY: Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    console.warn(`[API-RATELIMIT] Blocked POST /api/sumup/reconcile - User: ${session.user_id}`);
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const body = await request.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required (ISO 8601 format)" },
        { status: 400 }
      );
    }

    console.log(`[Reconcile] Starting reconciliation from ${startDate} to ${endDate}`);

    // Get SumUp credentials
    const { getStoredSumUpCredentials } = await import("@/app/api/sumup/credentials/route");
    const dbCreds = await getStoredSumUpCredentials(session.org_id);
    const apiKey = dbCreds?.api_key || process.env.SUMUP_API_KEY;
    const merchantCode = dbCreds?.merchant_code || process.env.SUMUP_MERCHANT_CODE;

    if (!apiKey || !merchantCode) {
      return NextResponse.json(
        { error: "SumUp not configured" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createSupabaseServerClient(supabaseUrl!, supabaseServiceKey!);

    // Fetch SumUp transactions for the date range
    const sumUpTransactions = await fetchSumUpTransactions(apiKey, merchantCode, startDate, endDate);

    // Fetch POS payments with SumUp metadata
    const { data: posPayments } = await supabase
      .from("payments")
      .select("id, receipt_id, method, amount, metadata")
      .eq("method", "card")
      .not("metadata", "is", null);

    // Create a map of POS transaction IDs for quick lookup
    const posTransactionMap = new Map<string, any>();
    if (posPayments) {
      posPayments.forEach((payment: any) => {
        const transactionId = payment.metadata?.transaction_id;
        if (transactionId) {
          posTransactionMap.set(transactionId, payment);
        }
      });
    }

    // Compare and find discrepancies
    const discrepancies: {
      missingInPos: Array<any>;
      missingInSumUp: Array<any>;
      matched: Array<any>;
    } = {
      missingInPos: [],
      missingInSumUp: [],
      matched: [],
    };

    // Check SumUp transactions against POS
    for (const sumUpTx of sumUpTransactions) {
      const posPayment = posTransactionMap.get(sumUpTx.transaction_code);
      if (posPayment) {
        discrepancies.matched.push({
          sumUp: sumUpTx,
          pos: posPayment,
          status: "matched",
        });
      } else {
        discrepancies.missingInPos.push({
          sumUp: sumUpTx,
          reason: "Transaction exists in SumUp but not in POS",
        });
      }
    }

    // Check POS payments against SumUp
    const sumUpTransactionIds = new Set(sumUpTransactions.map((tx: any) => tx.transaction_code));
    if (posPayments) {
      posPayments.forEach((payment: any) => {
        const transactionId = payment.metadata?.transaction_id;
        if (transactionId && !sumUpTransactionIds.has(transactionId)) {
          discrepancies.missingInSumUp.push({
            pos: payment,
            reason: "Payment exists in POS but not in SumUp",
          });
        }
      });
    }

    console.log(`[Reconcile] Reconciliation complete: ${discrepancies.matched.length} matched, ${discrepancies.missingInPos.length} missing in POS, ${discrepancies.missingInSumUp.length} missing in SumUp`);

    return NextResponse.json({
      success: true,
      startDate,
      endDate,
      summary: {
        totalSumUpTransactions: sumUpTransactions.length,
        totalPosPayments: posPayments?.length || 0,
        matched: discrepancies.matched.length,
        missingInPos: discrepancies.missingInPos.length,
        missingInSumUp: discrepancies.missingInSumUp.length,
      },
      discrepancies,
    });
  } catch (error) {
    console.error("[Reconcile] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function fetchSumUpTransactions(
  apiKey: string,
  merchantCode: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  const transactions: any[] = [];
  let hasMore = true;
  let limit = 100;
  let offset = 0;

  while (hasMore) {
    const url = new URL(`${process.env.SUMUP_API_BASE || 'https://api.sumup.com'}/v2.1/merchants/${merchantCode}/transactions`);
    url.searchParams.set("limit", limit.toString());
    url.searchParams.set("offset", offset.toString());
    url.searchParams.set("payment_type", "CARD");
    url.searchParams.set("status", "SUCCESSFUL");

    const response = await fetch(url.toString(), {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`SumUp API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.items) {
      transactions.push(...data.items);
      hasMore = data.items.length === limit;
      offset += limit;
    } else {
      hasMore = false;
    }

    // Safety limit to prevent infinite loops
    if (transactions.length > 10000) {
      console.warn("[Reconcile] Reached safety limit, stopping pagination");
      break;
    }
  }

  // Filter by date range (SumUp doesn't support date filter directly)
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  return transactions.filter((tx: any) => {
    const txDate = new Date(tx.timestamp);
    return txDate >= start && txDate <= end;
  });
}
