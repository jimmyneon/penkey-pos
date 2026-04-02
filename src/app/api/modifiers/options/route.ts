import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@penkey/database";
import { unauthorizedResponse, validatePOSSession } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Failed POST /api/modifiers/options: Invalid or missing session`);
    return unauthorizedResponse();
  }

  console.log(`[API-AUTH] POST /api/modifiers/options - User: ${session.user_id}, Org: ${session.org_id}`);

  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    console.warn(`[API-RATELIMIT] Blocked POST /api/modifiers/options - User: ${session.user_id}, Org: ${session.org_id}`);
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const body = await request.json();
    const { group_id, name, price_adjustment, sort_order } = body;

    if (!group_id || !name) {
      return NextResponse.json(
        { error: "group_id and name are required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify that the modifier group belongs to the user's organization
    const { data: group, error: groupError } = await supabase
      .from("modifier_groups")
      .select("org_id")
      .eq("id", group_id)
      .single();

    if (groupError || !group) {
      return NextResponse.json({ error: "Modifier group not found" }, { status: 404 });
    }

    if (group.org_id !== session.org_id) {
      console.warn(`[API-AUTH] Cross-tenant access attempt: User ${session.user_id} in Org ${session.org_id} tried to add option to group ${group_id} in Org ${group.org_id}`);
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("modifier_options")
      .insert({
        group_id,
        name,
        price_adjustment: price_adjustment || 0,
        sort_order: sort_order || 0,
        is_active: true,
        is_default: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[API-AUTH] Successful POST /api/modifiers/options - User: ${session.user_id}, Org: ${session.org_id}, Created: ${(data as any).id}`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
