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

    // Use service role key to bypass RLS
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all receipts for this shift with payments
    const { data: receipts, error } = await supabase
      .from("receipts")
      .select(`
        *,
        payments (
          id,
          method,
          amount,
          tip_amount
        )
      `)
      .eq("shift_id", shiftId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(receipts || []);
  } catch (error) {
    console.error("Error fetching receipts:", error);
    return NextResponse.json(
      { error: "Failed to fetch receipts" },
      { status: 500 }
    );
  }
}
