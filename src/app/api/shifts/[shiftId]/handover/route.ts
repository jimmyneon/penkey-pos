import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shiftId: string }> }
) {
  try {
    // Validate session
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { shiftId } = await params;
    const { fromEmployeeId, toEmployeeId } = await request.json();

    if (!shiftId || !fromEmployeeId || !toEmployeeId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get the shift
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

    // Update shift with new employee
    const { data: updatedShift, error: updateError } = await supabase
      .from("shifts")
      .update({
        member_id: toEmployeeId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", shiftId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Create audit log entry
    await supabase.from("shift_audit_log").insert({
      shift_id: shiftId,
      action: "handover",
      user_id: fromEmployeeId,
      old_value: { member_id: fromEmployeeId },
      new_value: { member_id: toEmployeeId },
    });

    return NextResponse.json(updatedShift);
  } catch (error) {
    console.error("Error handing over shift:", error);
    return NextResponse.json(
      { error: "Failed to hand over shift" },
      { status: 500 }
    );
  }
}
