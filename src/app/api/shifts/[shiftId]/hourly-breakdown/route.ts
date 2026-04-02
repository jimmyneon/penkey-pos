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
        created_at,
        receipt_lines:receipt_lines(
          quantity,
          price
        )
      `)
      .eq("shift_id", shiftId)
      .order("created_at", { ascending: true });

    if (receiptsError) throw receiptsError;

    // Group by hour
    const hourlyData: { [key: string]: { sales: number; items: number; transactions: number } } = {};

    receipts?.forEach((receipt: any) => {
      if (receipt.status === "completed" || receipt.status === "partially_refunded") {
        const date = new Date(receipt.created_at);
        const hour = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        const hourKey = hour.split(":")[0] + ":00"; // Round to hour

        if (!hourlyData[hourKey]) {
          hourlyData[hourKey] = { sales: 0, items: 0, transactions: 0 };
        }

        hourlyData[hourKey].transactions++;

        if (receipt.receipt_lines && Array.isArray(receipt.receipt_lines)) {
          receipt.receipt_lines.forEach((line: any) => {
            hourlyData[hourKey].items += line.quantity || 0;
            hourlyData[hourKey].sales += (line.quantity || 0) * (line.price || 0);
          });
        }
      }
    });

    // Convert to array and sort
    const result = Object.entries(hourlyData)
      .map(([hour, data]) => ({
        hour,
        ...data,
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching hourly breakdown:", error);
    return NextResponse.json(
      { error: "Failed to fetch hourly breakdown" },
      { status: 500 }
    );
  }
}
