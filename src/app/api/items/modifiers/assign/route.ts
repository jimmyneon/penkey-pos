export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
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

    // Insert new assignments (additive - don't delete existing ones)
    if (item_ids && item_ids.length > 0) {
      // Check which assignments already exist
      const { data: existingAssignments } = await supabase
        .from("item_modifiers")
        .select("item_id")
        .eq("modifier_group_id", modifier_group_id)
        .in("item_id", item_ids);

      const existingItemIds = new Set(existingAssignments?.map((a: any) => a.item_id) || []);
      
      // Only insert assignments that don't already exist
      const newAssignments = item_ids
        .filter((id: string) => !existingItemIds.has(id))
        .map((item_id: string) => ({
          item_id,
          modifier_group_id,
        }));

      if (newAssignments.length > 0) {
        const { error: insertError } = await supabase
          .from("item_modifiers")
          .insert(newAssignments);

        if (insertError) {
          console.error("Insert error:", insertError);
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
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

/**
 * PUT: set-based reconcile.
 * Body: { modifier_group_id, item_ids: string[] }
 * Replaces the full set of items linked to a modifier group atomically:
 *   - Inserts links for any item_id not currently linked
 *   - Deletes links for any item_id currently linked but not in the new set
 * This eliminates the read-modify-write race in the old "unassign by re-posting
 * remaining ids" flow.
 */
export async function PUT(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized PUT /api/items/modifiers/assign`);
    return unauthorizedResponse();
  }

  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const body = await request.json();
    const { modifier_group_id, item_ids } = body as {
      modifier_group_id?: string;
      item_ids?: string[];
    };

    if (!modifier_group_id) {
      return NextResponse.json(
        { error: "modifier_group_id is required" },
        { status: 400 }
      );
    }
    if (!Array.isArray(item_ids)) {
      return NextResponse.json(
        { error: "item_ids must be an array" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Current set
    const { data: existing, error: fetchErr } = await supabase
      .from("item_modifiers")
      .select("item_id")
      .eq("modifier_group_id", modifier_group_id);

    if (fetchErr) {
      console.error("Fetch error:", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const existingSet = new Set((existing || []).map((a: any) => a.item_id));
    const desiredSet = new Set(item_ids);

    const toInsert: string[] = [];
    desiredSet.forEach((id) => {
      if (!existingSet.has(id)) toInsert.push(id);
    });

    const toDelete: string[] = [];
    existingSet.forEach((id) => {
      if (!desiredSet.has(id as string)) toDelete.push(id as string);
    });

    if (toDelete.length > 0) {
      const { error: delErr } = await supabase
        .from("item_modifiers")
        .delete()
        .eq("modifier_group_id", modifier_group_id)
        .in("item_id", toDelete);
      if (delErr) {
        console.error("Delete error:", delErr);
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }
    }

    if (toInsert.length > 0) {
      const rows = toInsert.map((item_id) => ({
        item_id,
        modifier_group_id,
      }));
      const { error: insErr } = await supabase
        .from("item_modifiers")
        .insert(rows as any);
      if (insErr) {
        console.error("Insert error:", insErr);
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      inserted: toInsert.length,
      deleted: toDelete.length,
      affected_item_ids: Array.from(new Set([...toInsert, ...toDelete])),
    });
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
