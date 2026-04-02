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

    // Get receipts for this shift
    const { data: receipts, error: receiptsError } = await supabase
      .from("receipts")
      .select(`
        id,
        status,
        refunded_amount,
        receipt_lines:receipt_lines(
          quantity,
          price
        ),
        receipt_payments:receipt_payments(
          method,
          amount
        )
      `)
      .eq("shift_id", shiftId);

    if (receiptsError) throw receiptsError;

    // Calculate totals
    let totalSales = 0;
    let itemsSold = 0;
    let transactions = 0;
    let refunds = 0;
    let voids = 0;
    let refundAmount = 0;
    let voidAmount = 0;

    receipts?.forEach((receipt: any) => {
      if (receipt.status === "completed" || receipt.status === "partially_refunded") {
        transactions++;
        
        // Count items
        if (receipt.receipt_lines && Array.isArray(receipt.receipt_lines)) {
          receipt.receipt_lines.forEach((line: any) => {
            itemsSold += line.quantity || 0;
            totalSales += (line.quantity || 0) * (line.price || 0);
          });
        }
      }

      if (receipt.status === "fully_refunded") {
        refunds++;
        refundAmount += receipt.refunded_amount || 0;
      } else if (receipt.status === "partially_refunded") {
        voids++;
        voidAmount += receipt.refunded_amount || 0;
      }
    });

    return NextResponse.json({
      totalSales,
      itemsSold,
      transactions,
      refunds,
      refundAmount,
      voids,
      voidAmount,
    });
  } catch (error) {
    console.error("Error fetching sales summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales summary" },
      { status: 500 }
    );
  }
}
