import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";

export async function GET(request: NextRequest) {
  try {
    const registerId = request.nextUrl.searchParams.get("registerId");
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "10");

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

    // Get closed shifts for this register
    const { data: shifts, error } = await supabase
      .from("shifts")
      .select("*")
      .eq("register_id", registerId)
      .eq("status", "closed")
      .order("closed_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching shift history:", error);
      throw error;
    }

    return NextResponse.json(shifts || []);
  } catch (error) {
    console.error("Error fetching shift history:", error);
    return NextResponse.json(
      { error: "Failed to fetch shift history" },
      { status: 500 }
    );
  }
}
