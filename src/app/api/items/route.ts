export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { unauthorizedResponse, validatePOSSession } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Failed GET /api/items: Invalid or missing session`);
    return unauthorizedResponse();
  }

  console.log(`[API-AUTH] GET /api/items - User: ${session.user_id}, Org: ${session.org_id}`);

  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    console.warn(`[API-RATELIMIT] Blocked GET /api/items - User: ${session.user_id}, Org: ${session.org_id}`);
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("category_id");
    const favourites = searchParams.get("favourites");

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase
      .from("items")
      .select(
        `
        *,
        categories(name, color),
        item_variants(id, name, price, is_default)
      `
      )
      .eq("org_id", session.org_id)
      .eq("is_active", true);

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    if (favourites === "true") {
      query = query.eq("is_favourite", true).order("favourite_position", { ascending: true, nullsFirst: false });
    } else {
      query = query.order("name");
    }

    const { data, error } = await query;

    if (error) throw error;

    console.log(`[API-AUTH] Successful GET /api/items - User: ${session.user_id}, Org: ${session.org_id}, Found: ${data?.length || 0}`);
    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("Failed to fetch items:", error);
    return NextResponse.json(
      { error: "Failed to fetch items" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Failed POST /api/items: Invalid or missing session`);
    return unauthorizedResponse();
  }

  console.log(`[API-AUTH] POST /api/items - User: ${session.user_id}, Org: ${session.org_id}`);

  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    console.warn(`[API-RATELIMIT] Blocked POST /api/items - User: ${session.user_id}, Org: ${session.org_id}`);
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const body = await request.json();
    const { name, category_id, base_price, sku, description } = body;

    if (!name || !base_price) {
      return NextResponse.json(
        { error: "name and base_price are required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("items")
      .insert({
        org_id: session.org_id,
        name,
        category_id: category_id || null,
        base_price: parseFloat(base_price),
        sku: sku || null,
        description: description || null,
        has_variants: false,
        track_inventory: true,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[API-AUTH] Successful POST /api/items - User: ${session.user_id}, Org: ${session.org_id}, Created: ${(data as any).id}`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
