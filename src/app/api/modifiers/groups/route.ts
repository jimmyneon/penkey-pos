import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { unauthorizedResponse, validatePOSSession } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function POST(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Failed POST /api/modifiers/groups: Invalid or missing session`);
    return unauthorizedResponse();
  }

  console.log(`[API-AUTH] POST /api/modifiers/groups - User: ${session.user_id}, Org: ${session.org_id}`);

  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    console.warn(`[API-RATELIMIT] Blocked POST /api/modifiers/groups - User: ${session.user_id}, Org: ${session.org_id}`);
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const body = await request.json();
    const { name, selection_type, min_selections, max_selections } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("modifier_groups")
      .insert({
        org_id: session.org_id,
        name,
        selection_type: selection_type || "optional",
        min_selections: min_selections || 0,
        max_selections: max_selections || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[API-AUTH] Successful POST /api/modifiers/groups - User: ${session.user_id}, Org: ${session.org_id}, Created: ${(data as any).id}`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Failed GET /api/modifiers/groups: Invalid or missing session`);
    return unauthorizedResponse();
  }

  console.log(`[API-AUTH] GET /api/modifiers/groups - User: ${session.user_id}, Org: ${session.org_id}`);

  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    console.warn(`[API-RATELIMIT] Blocked GET /api/modifiers/groups - User: ${session.user_id}, Org: ${session.org_id}`);
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: groups, error: groupsError } = await supabase
      .from("modifier_groups")
      .select(
        `
        id,
        name,
        selection_type,
        min_selections,
        max_selections,
        sort_order,
        modifier_options (
          id,
          name,
          price_adjustment,
          is_default,
          sort_order,
          is_active
        )
      `
      )
      .eq("org_id", session.org_id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (groupsError) {
      console.error("Supabase error:", groupsError);
      return NextResponse.json({ error: groupsError.message }, { status: 500 });
    }

    const sortedGroups = (groups || []).map((group: any) => ({
      ...group,
      modifier_options: (group.modifier_options || []).sort(
        (a: any, b: any) => a.sort_order - b.sort_order
      ),
    }));

    console.log(`[API-AUTH] Successful GET /api/modifiers/groups - User: ${session.user_id}, Org: ${session.org_id}, Found: ${sortedGroups.length}`);
    return NextResponse.json(sortedGroups);
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
