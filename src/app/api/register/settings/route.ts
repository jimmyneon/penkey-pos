import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@penkey/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized GET /api/register/settings`);
    return unauthorizedResponse();
  }

  // ✅ SECURITY: Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("org_id");

    // ✅ SECURITY: Verify org_id matches session
    if (!orgId || orgId !== session.org_id) {
      console.warn(`[API-AUTH] Org mismatch - Request: ${orgId}, Session: ${session.org_id}`);
      return unauthorizedResponse();
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get register settings for the register
    // First, get the register ID from the query params
    const registerId = searchParams.get("register_id");
    
    if (!registerId) {
      return NextResponse.json(
        { error: "register_id is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("register_settings")
      .select("*")
      .eq("register_id", registerId)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      throw error;
    }

    // Return empty object if no settings found
    return NextResponse.json(data || {});
  } catch (error: any) {
    console.error("Register settings fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch register settings" },
      { status: 500 }
    );
  }
}
