export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { isAuthRateLimited, recordAuthFailure, recordAuthSuccess, getAuthRateLimitRemaining } from "@/lib/api/auth-ratelimit";

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Check rate limiting first
    if (isAuthRateLimited(request)) {
      const remaining = getAuthRateLimitRemaining(request);
      console.warn(`[AUTH-RATELIMIT] PIN attempt blocked. Retry after ${remaining}s`);
      return NextResponse.json(
        { error: `Too many PIN attempts. Please try again in ${remaining} seconds.` },
        { status: 429 }
      );
    }

    const { pin } = await request.json();

    if (!pin || pin.length !== 4) {
      return NextResponse.json(
        { error: "Invalid PIN format" },
        { status: 400 }
      );
    }

    // Get the current session to identify the user
    const sessionCookie = request.cookies.get('pos_session');
    if (!sessionCookie) {
      return NextResponse.json(
        { error: "No active session. Please log in with email and password first." },
        { status: 401 }
      );
    }

    let sessionData;
    try {
      sessionData = JSON.parse(sessionCookie.value);
    } catch {
      return NextResponse.json(
        { error: "Invalid session" },
        { status: 401 }
      );
    }

    if (!sessionData.user_id) {
      return NextResponse.json(
        { error: "Invalid session data" },
        { status: 401 }
      );
    }

    // Create Supabase client with service role key for PIN verification
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get the employee record for the current user only
    const { data: employeeData, error: employeeError } = await supabase
      .from("org_members")
      .select(`
        id,
        org_id,
        first_name,
        last_name,
        display_name,
        role_id,
        employee_pins(pin_hash),
        roles(name, permissions)
      `)
      .eq("user_id", sessionData.user_id)
      .single() as any;

    if (employeeError || !employeeData) {
      return NextResponse.json(
        { error: "Employee record not found" },
        { status: 404 }
      );
    }

    // Verify the PIN for this specific employee
    const { data: isValid } = await supabase.rpc("verify_pin", {
      p_pin: pin,
      p_hash: employeeData.employee_pins?.pin_hash,
    } as any);

    if (!isValid) {
      // ✅ SECURITY: Record failed attempt
      recordAuthFailure(request);
      return NextResponse.json(
        { error: "Invalid PIN" },
        { status: 401 }
      );
    }

    // Get register for this location (for now, use first active register)
    const { data: register } = await supabase
      .from("registers")
      .select("id, name, store_id, stores(name)")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!register) {
      return NextResponse.json(
        { error: "No active register found" },
        { status: 404 }
      );
    }

    // Create session data
    const session = {
      employee: {
        id: employeeData.id,
        name: employeeData.display_name || employeeData.first_name,
        role: employeeData.roles?.name,
      },
      register: {
        id: (register as any).id,
        name: (register as any).name,
        store_id: (register as any).store_id,
        store_name: (register as any).stores?.name,
      },
      org_id: employeeData.org_id,
      timestamp: new Date().toISOString(),
    };

    // ✅ SECURITY: Record successful PIN verification (clears rate limit)
    recordAuthSuccess(request);

    return NextResponse.json(session);
  } catch (error: any) {
    console.error("PIN verification error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
