export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { ratelimit } from "@/lib/ratelimit";

// Penkey organization ID (single-tenant deployment)
const PENKEY_ORG_ID = "00000000-0000-0000-0000-000000000001";
// CORS: allow Perks app
const CORS_ORIGIN = "https://penkey-perks-v2.vercel.app";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

export async function GET(request: NextRequest) {
  // IP-based rate limiting for public endpoint
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    console.warn(`[PUBLIC-API] Rate limited GET /api/public/menu - IP: ${ip}`);
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("items")
      .select(
        `
        id,
        name,
        description,
        base_price,
        categories(id, name, color),
        item_variants(id, name, price, is_default),
        item_modifiers(
          sort_order,
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
        )
      `
      )
      .eq("org_id", PENKEY_ORG_ID)
      .eq("is_active", true)
      .order("name");

    if (error) throw error;

    // Flatten and sort modifier groups for each item
    const processedData = (data || []).map((item: any) => {
      const modifierGroups = (item.item_modifiers || [])
        .map((im: any) => ({
          id: im.modifier_groups?.id,
          name: im.modifier_groups?.name,
          selection_type: im.modifier_groups?.selection_type,
          min_selections: im.modifier_groups?.min_selections,
          max_selections: im.modifier_groups?.max_selections,
          sort_order: im.modifier_groups?.sort_order,
          item_sort_order: im.sort_order,
          modifier_options: (im.modifier_groups?.modifier_options || [])
            .filter((opt: any) => opt.is_active)
            .sort((a: any, b: any) => a.sort_order - b.sort_order),
        }))
        .filter((g: any) => g.id !== null && g.modifier_options.length > 0);

      // Sort by item_modifiers.sort_order, then by modifier_groups.sort_order
      modifierGroups.sort((a: any, b: any) => {
        const itemSort = (a.item_sort_order ?? 0) - (b.item_sort_order ?? 0);
        if (itemSort !== 0) return itemSort;
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });

      return {
        id: item.id,
        name: item.name,
        description: item.description,
        base_price: item.base_price,
        categories: item.categories,
        item_variants: item.item_variants,
        modifier_groups: modifierGroups,
      };
    });

    console.log(`[PUBLIC-API] GET /api/public/menu - Found: ${processedData.length}`);
    return NextResponse.json(processedData, {
      headers: {
        'Access-Control-Allow-Origin': CORS_ORIGIN,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  } catch (error: any) {
    console.error("[PUBLIC-API] Failed to fetch menu:", error);
    return NextResponse.json(
      { error: "Failed to fetch menu" },
      { status: 500 }
    );
  }
}
