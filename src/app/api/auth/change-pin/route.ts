import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@penkey/database";

export async function POST(request: NextRequest) {
  try {
    const { employeeId, newPin } = await request.json();

    if (!employeeId || !newPin) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      return NextResponse.json(
        { error: "PIN must be exactly 4 digits" },
        { status: 400 }
      );
    }

    // Create Supabase client with service role key
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Hash the new PIN using the database function
    const { data: hashedPin, error: hashError } = await supabase.rpc(
      "hash_pin",
      { p_pin: newPin }
    );

    if (hashError) {
      console.error("Error hashing PIN:", hashError);
      throw new Error("Failed to hash PIN");
    }

    // Update the employee_pins table
    const { error: updateError } = await supabase
      .from("employee_pins")
      .update({ 
        pin_hash: hashedPin,
        updated_at: new Date().toISOString()
      })
      .eq("member_id", employeeId);

    if (updateError) {
      console.error("Error updating PIN:", updateError);
      throw new Error("Failed to update PIN");
    }

    return NextResponse.json({ 
      success: true,
      message: "PIN updated successfully" 
    });
  } catch (error: any) {
    console.error("Change PIN error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to change PIN" },
      { status: 500 }
    );
  }
}
