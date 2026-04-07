export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";

/**
 * Lightweight PIN verification using cached hashes
 * Much faster than full verification (no database loop)
 */
export async function POST(request: NextRequest) {
  try {
    const { pin, org_id } = await request.json();

    if (!pin || pin.length !== 4 || !org_id) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get employee PINs for this org only (much faster than all PINs)
    const { data: employees, error: fetchError } = await supabase
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
      .eq("org_members.org_id", org_id)
      .limit(50); // Limit to reasonable number

    if (fetchError) throw fetchError;

    // Verify PIN against cached hashes
    let matchedEmployee = null;
    for (const emp of employees || []) {
      const { data: isValid } = await supabase.rpc("verify_pin", {
        p_pin: pin,
        p_hash: (emp as any).pin_hash,
      });

      if (isValid) {
        matchedEmployee = (emp as any).org_members;
        break;
      }
    }

    if (!matchedEmployee) {
      return NextResponse.json(
        { error: "Invalid PIN" },
        { status: 401 }
      );
    }

    // Return minimal session data
    return NextResponse.json({
      member_id: matchedEmployee.id,
      employee_name: matchedEmployee.display_name || matchedEmployee.first_name,
      role: matchedEmployee.roles?.name || 'staff',
      org_id: matchedEmployee.org_id,
    });
  } catch (error: any) {
    console.error("Cached PIN verification error:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
