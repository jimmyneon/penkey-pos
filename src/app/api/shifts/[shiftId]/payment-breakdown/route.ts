import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@penkey/database";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shiftId: string }> }
) {
  try {
    const { shiftId } = await params;

    if (!shiftId) {
      return NextResponse.json(
        { error: "Missing shift ID" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get receipts with payments for this shift
    const { data: receipts, error: receiptsError } = await supabase
      .from("receipts")
      .select(`
        id,
        status,
        receipt_payments:receipt_payments(
          method,
          amount
        )
      `)
      .eq("shift_id", shiftId);

    if (receiptsError) throw receiptsError;

    // Calculate payment totals
    let cashTotal = 0;
    let cardTotal = 0;
    let otherTotal = 0;

    receipts?.forEach((receipt: any) => {
      if (receipt.status === "completed" || receipt.status === "partially_refunded") {
        if (receipt.receipt_payments && Array.isArray(receipt.receipt_payments)) {
          receipt.receipt_payments.forEach((payment: any) => {
            const amount = payment.amount || 0;
            switch (payment.method?.toLowerCase()) {
              case "cash":
                cashTotal += amount;
                break;
              case "card":
              case "credit_card":
              case "debit_card":
                cardTotal += amount;
                break;
              default:
                otherTotal += amount;
            }
          });
        }
      }
    });

    return NextResponse.json({
      cashTotal,
      cardTotal,
      otherTotal,
    });
  } catch (error) {
    console.error("Error fetching payment breakdown:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment breakdown" },
      { status: 500 }
    );
  }
}
