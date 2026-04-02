import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@penkey/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized GET /api/items/[id]/modifiers/full`);
    return unauthorizedResponse();
  }

  // ✅ SECURITY: Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const { id: itemId } = await params;

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get modifier groups linked to this item with full details
    const { data, error } = await supabase
      .from("item_modifiers")
      .select(`
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
      .eq("item_id", itemId)
      .order("sort_order");

    if (error) throw error;

    // Extract and flatten the modifier groups, preserving item_modifiers.sort_order
    const modifierGroups = data
      ?.map((im: any) => ({
        ...im.modifier_groups,
        item_sort_order: im.sort_order // Preserve the item-specific sort order
      }))
      .filter((g: any) => g !== null) || [];

    // Sort by item_modifiers.sort_order (item_sort_order), then by modifier_groups.sort_order
    modifierGroups.sort((a: any, b: any) => {
      const itemSort = (a.item_sort_order ?? 0) - (b.item_sort_order ?? 0);
      if (itemSort !== 0) return itemSort;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

    return NextResponse.json(modifierGroups);
  } catch (error: any) {
    console.error("Failed to fetch item modifiers:", error);
    return NextResponse.json(
      { error: "Failed to fetch item modifiers" },
      { status: 500 }
    );
  }
}
