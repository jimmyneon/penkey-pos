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

    // Create Supabase client with service role key for PIN verification
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Optimized: Use database function to verify PIN in single query
    // This uses PostgreSQL's crypt function to compare hashes efficiently
    const { data: employees, error: verifyError } = await supabase
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
          roles(name, permissions)
        )
      `)
      .limit(100); // Get all employees to check

    if (verifyError) throw verifyError;

    // Find matching PIN by verifying hash
    let matchedEmployee = null;
    for (const emp of employees || []) {
      // Use the database function to verify PIN
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
        id: (matchedEmployee as any).id,
        name: (matchedEmployee as any).display_name || (matchedEmployee as any).first_name,
        role: (matchedEmployee as any).roles?.name,
      },
      register: {
        id: (register as any).id,
        name: (register as any).name,
        store_id: (register as any).store_id,
        store_name: (register as any).stores?.name,
      },
      org_id: (matchedEmployee as any).org_id,
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
