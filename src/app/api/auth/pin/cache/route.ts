import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@penkey/database";

/**
 * Fetch PIN hashes for caching
 * Only returns hashes, not actual PINs (secure)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("org_id");

    if (!orgId) {
      return NextResponse.json(
        { error: "org_id required" },
        { status: 400 }
      );
    }

    // Create Supabase client with service role key
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all employee PINs for this org
    const { data: pins, error: pinsError } = await supabase
      .from("employee_pins")
      .select(`
        pin_hash,
        org_members!inner(
          id,
          org_id,
          first_name,
          last_name,
          display_name,
          role_id,
          roles(name)
        )
      `)
      .eq("org_members.org_id", orgId);

    if (pinsError) throw pinsError;

    // Transform to cacheable format
    const cachedPins = (pins || []).map((pin: any) => ({
      member_id: pin.org_members.id,
      pin_hash: pin.pin_hash,
      org_id: pin.org_members.org_id,
      employee_name: pin.org_members.display_name || pin.org_members.first_name,
      role: pin.org_members.roles?.name || 'staff',
      cached_at: Date.now(),
    }));

    return NextResponse.json(cachedPins);
  } catch (error: any) {
    console.error("PIN cache fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch PIN cache" },
      { status: 500 }
    );
  }
}
