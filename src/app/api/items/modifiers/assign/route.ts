import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@penkey/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function POST(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized POST /api/items/modifiers/assign`);
    return unauthorizedResponse();
  }

  // ✅ SECURITY: Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const body = await request.json();
    const { modifier_group_id, item_ids } = body;

    if (!modifier_group_id) {
      return NextResponse.json(
        { error: "modifier_group_id is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // First, delete all existing assignments for this modifier group
    const { error: deleteError } = await supabase
      .from("item_modifiers")
      .delete()
      .eq("modifier_group_id", modifier_group_id);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Then, insert new assignments
    if (item_ids && item_ids.length > 0) {
      const assignments = item_ids.map((item_id: string) => ({
        item_id,
        modifier_group_id,
      }));

      const { error: insertError } = await supabase
        .from("item_modifiers")
        .insert(assignments);

      if (insertError) {
        console.error("Insert error:", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
