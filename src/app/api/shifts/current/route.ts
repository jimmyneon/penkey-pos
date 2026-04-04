import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";

export async function GET(request: NextRequest) {
  try {
    const registerId = request.nextUrl.searchParams.get("registerId");

    if (!registerId) {
      return NextResponse.json(
        { error: "Missing register ID" },
        { status: 400 }
      );
    }

    // Use service role key to bypass RLS
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get the current open shift
    const { data: shifts, error } = await supabase
      .from("shifts")
      .select("*")
      .eq("register_id", registerId)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Error fetching current shift:", error);
      throw error;
    }

    const shift = shifts && shifts.length > 0 ? shifts[0] : null;
    console.log("Current shift found:", shift);
    return NextResponse.json(shift);
  } catch (error) {
    console.error("Error fetching current shift:", error);
    return NextResponse.json(
      { error: "Failed to fetch shift" },
      { status: 500 }
    );
  }
}
