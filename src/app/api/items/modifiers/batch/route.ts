export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

/**
 * Batch fetch all item -> modifier_group associations for an org in a single
 * request. Replaces N parallel /api/items/{id}/modifiers/full calls during
 * prefetch / sync, dramatically reducing the chance of partial failure that
 * caused modifier links to disappear locally.
 *
 * Returns: { items: Array<{ item_id, groups: ModifierGroup[] }> }
 */
export async function GET(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized GET /api/items/modifiers/batch`);
    return unauthorizedResponse();
  }

  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("org_id") || session.org_id;

    if (!orgId) {
      return NextResponse.json({ error: "org_id is required" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all item ids for this org first (so we can return rows even for items
    // with zero modifier groups assigned).
    const { data: items, error: itemsErr } = await supabase
      .from("items")
      .select("id")
      .eq("org_id", orgId);

    if (itemsErr) throw itemsErr;

    // Fetch ALL item_modifiers + their groups + options in one query, scoped by org.
    // We rely on RLS / org scoping via the items join filter.
    const itemIds = (items || []).map((i: any) => i.id);
    if (itemIds.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const { data: links, error: linksErr } = await supabase
      .from("item_modifiers")
      .select(`
        item_id,
        sort_order,
        modifier_group_id,
        modifier_groups(
          id,
          name,
          selection_type,
          min_selections,
          max_selections,
          sort_order,
          modifier_options(
            id,
            name,
            price_adjustment,
            is_default,
            is_active,
            sort_order
          )
        )
      `)
      .in("item_id", itemIds)
      .order("sort_order");

    if (linksErr) throw linksErr;

    // Group by item_id with the same shape as /api/items/[id]/modifiers/full
    const byItem = new Map<string, any[]>();
    for (const id of itemIds) byItem.set(id, []);

    for (const link of links || []) {
      const group = (link as any).modifier_groups;
      if (!group) continue;
      const arr = byItem.get((link as any).item_id) || [];
      arr.push({
        ...group,
        item_sort_order: (link as any).sort_order,
      });
      byItem.set((link as any).item_id, arr);
    }

    // Sort groups within each item (same logic as the per-item endpoint)
    const result: Array<{ item_id: string; groups: any[] }> = [];
    byItem.forEach((arr, item_id) => {
      arr.sort((a: any, b: any) => {
        const itemSort = (a.item_sort_order ?? 0) - (b.item_sort_order ?? 0);
        if (itemSort !== 0) return itemSort;
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
      result.push({ item_id, groups: arr });
    });

    return NextResponse.json({ items: result });
  } catch (error: any) {
    console.error("[/api/items/modifiers/batch] error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
