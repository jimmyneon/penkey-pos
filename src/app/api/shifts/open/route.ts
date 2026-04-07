export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";

export async function POST(request: NextRequest) {
  try {
    const { registerId, memberId, openingCash, floatAmount } = await request.json();

    if (!registerId || !memberId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Use service role key to bypass RLS for creating shifts
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if there's already an open shift
    const { data: openShifts } = await supabase
      .from("shifts")
      .select("*")
      .eq("register_id", registerId)
      .eq("status", "open")
      .limit(1);

    if (openShifts && openShifts.length > 0) {
      console.log("Existing open shift found:", openShifts[0].id);
      return NextResponse.json(
        { error: "A shift is already open on this register", existingShiftId: openShifts[0].id },
        { status: 409 }
      );
    }

    // Create new shift
    const { data: newShift, error } = await supabase
      .from("shifts")
      .insert({
        register_id: registerId,
        member_id: memberId,
        status: "open",
        opening_cash: openingCash || 0,
        float_amount: floatAmount || 100, // Default to £100 if not provided
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(newShift);
  } catch (error) {
    console.error("Error opening shift:", error);
    return NextResponse.json(
      { error: "Failed to open shift" },
      { status: 500 }
    );
  }
}
