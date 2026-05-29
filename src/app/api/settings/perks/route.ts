export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { unauthorizedResponse, validatePOSSession } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Failed GET /api/settings/perks: Invalid or missing session`);
    return unauthorizedResponse();
  }

  console.log(`[API-AUTH] GET /api/settings/perks - User: ${session.user_id}, Org: ${session.org_id}`);

  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    console.warn(`[API-RATELIMIT] Blocked GET /api/settings/perks - User: ${session.user_id}, Org: ${session.org_id}`);
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("org_settings")
      .select("settings")
      .eq("org_id", session.org_id)
      .single();

    if (error) {
      // If no settings exist, return empty perks config
      if (error.code === 'PGRST116') {
        return NextResponse.json({ perks: { domain: "", apiKey: "" } });
      }
      throw error;
    }

    const settings = (data as any)?.settings as any || {};
    const perks = settings.perks || { domain: "", apiKey: "" };

    return NextResponse.json(perks);
  } catch (error: any) {
    console.error("Failed to fetch Perks settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch Perks settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Failed POST /api/settings/perks: Invalid or missing session`);
    return unauthorizedResponse();
  }

  console.log(`[API-AUTH] POST /api/settings/perks - User: ${session.user_id}, Org: ${session.org_id}`);

  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    console.warn(`[API-RATELIMIT] Blocked POST /api/settings/perks - User: ${session.user_id}, Org: ${session.org_id}`);
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const body = await request.json();
    const { domain, apiKey } = body;

    if (!domain || !apiKey) {
      return NextResponse.json(
        { error: "domain and apiKey are required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Upsert org_settings with perks config
    const { data, error } = await supabase
      .from("org_settings")
      .upsert(
        {
          org_id: session.org_id,
          settings: {
            perks: { domain, apiKey },
          },
        } as any,
        {
          onConflict: "org_id",
        }
      )
      .select()
      .single();

    if (error) throw error;

    console.log(`[API-AUTH] Successful POST /api/settings/perks - User: ${session.user_id}, Org: ${session.org_id}`);
    return NextResponse.json({ success: true, perks: { domain, apiKey } });
  } catch (error: any) {
    console.error("Failed to save Perks settings:", error);
    return NextResponse.json(
      { error: "Failed to save Perks settings" },
      { status: 500 }
    );
  }
}
