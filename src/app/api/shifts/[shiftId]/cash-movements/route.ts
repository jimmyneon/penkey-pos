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

    const { data: movements, error } = await supabase
      .from("cash_movements")
      .select("*")
      .eq("shift_id", shiftId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(movements || []);
  } catch (error) {
    console.error("Error fetching cash movements:", error);
    return NextResponse.json(
      { error: "Failed to fetch cash movements" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shiftId: string }> }
) {
  try {
    const { shiftId } = await params;
    const { type, amount, reason, memberId } = await request.json();

    if (!shiftId || !type || !amount || !reason) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!["pay_in", "pay_out"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid movement type" },
        { status: 400 }
      );
    }

    // Use service role key to bypass RLS
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: movements, error } = await supabase
      .from("cash_movements")
      .insert({
        shift_id: shiftId,
        type,
        amount,
        reason,
        member_id: memberId || null,
      })
      .select();

    const movement = movements && movements.length > 0 ? movements[0] : null;

    if (error) throw error;

    return NextResponse.json(movement);
  } catch (error) {
    console.error("Error creating cash movement:", error);
    return NextResponse.json(
      { error: "Failed to create cash movement" },
      { status: 500 }
    );
  }
}
