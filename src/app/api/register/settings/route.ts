export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
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

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get register settings for the register
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

export async function POST(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized POST /api/register/settings`);
    return unauthorizedResponse();
  }

  // ✅ SECURITY: Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const body = await request.json();
    const { register_id, settings, org_id } = body;

    if (!register_id) {
      return NextResponse.json(
        { error: "register_id is required" },
        { status: 400 }
      );
    }

    if (!settings) {
      return NextResponse.json(
        { error: "settings object is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ✅ SECURITY: Verify org_id matches session (use provided org_id or session org_id)
    const requestOrgId = org_id || session.org_id;
    if (requestOrgId !== session.org_id) {
      console.warn(`[API-AUTH] Org mismatch - Request: ${requestOrgId}, Session: ${session.org_id}`);
      return unauthorizedResponse();
    }

    // Upsert settings
    const { data, error } = await supabase
      .from("register_settings")
      .upsert({
        register_id,
        org_id: requestOrgId,
        ...settings,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "register_id",
      })
      .select()
      .single();

    if (error) {
      console.error("Register settings update error:", error);
      throw error;
    }

    console.log("[Register Settings] Updated successfully for register:", register_id);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Register settings update error:", error);
    return NextResponse.json(
      { error: "Failed to update register settings" },
      { status: 500 }
    );
  }
}
