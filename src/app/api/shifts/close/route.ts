import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";

export async function POST(request: NextRequest) {
  try {
    const { shiftId, closingCash, notes, nextFloatAmount, cashRemoved } = await request.json();

    if (!shiftId) {
      return NextResponse.json(
        { error: "Missing shift ID" },
        { status: 400 }
      );
    }

    // Use service role key to bypass RLS for closing shifts
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get the shift to calculate expected cash
    const { data: shift, error: fetchError } = await supabase
      .from("shifts")
      .select("*")
      .eq("id", shiftId)
      .single();

    if (fetchError || !shift) {
      return NextResponse.json(
        { error: "Shift not found" },
        { status: 404 }
      );
    }

    // Get all cash movements for this shift
    const { data: movements } = await supabase
      .from("cash_movements")
      .select("*")
      .eq("shift_id", shiftId);

    // Calculate expected cash
    let expectedCash = (shift as any).opening_cash || 0;
    if (movements) {
      movements.forEach((movement: any) => {
        if (movement.type === "pay_in") {
          expectedCash += movement.amount;
        } else if (movement.type === "pay_out") {
          expectedCash -= movement.amount;
        }
      });
    }

    // Get all receipts for this shift to add sales
    const { data: receipts } = await supabase
      .from("receipts")
      .select("total")
      .eq("shift_id", shiftId);

    if (receipts) {
      receipts.forEach((receipt: any) => {
        expectedCash += receipt.total || 0;
      });
    }

    // Calculate variance
    const variance = closingCash - expectedCash;

    // Update shift (save nextFloatAmount so next shift can use it)
    const { data: updatedShift, error: updateError } = await supabase
      .from("shifts")
      .update({
        status: "closed",
        closing_cash: closingCash,
        expected_cash: expectedCash,
        variance: variance,
        float_amount: nextFloatAmount || (shift as any).float_amount, // Save next shift's float
        notes: notes || null,
        closed_at: new Date().toISOString(),
        cash_removed: cashRemoved || false, // Track if cash was removed to safe
      })
      .eq("id", shiftId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json(updatedShift);
  } catch (error) {
    console.error("Error closing shift:", error);
    return NextResponse.json(
      { error: "Failed to close shift" },
      { status: 500 }
    );
  }
}
