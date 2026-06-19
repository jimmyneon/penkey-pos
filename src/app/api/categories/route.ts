export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { unauthorizedResponse, validatePOSSession } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function POST(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Failed POST /api/categories: Invalid or missing session`);
    return unauthorizedResponse();
  }

  console.log(`[API-AUTH] POST /api/categories - User: ${session.user_id}, Org: ${session.org_id}`);

  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    console.warn(`[API-RATELIMIT] Blocked POST /api/categories - User: ${session.user_id}, Org: ${session.org_id}`);
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const body = await request.json();
    const { name, color, description, sort_order, icon, icon_color, type } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("categories")
      .insert({
        org_id: session.org_id, // Use org_id from session
        name,
        color: color || "#f97316",
        description: description || null,
        is_active: true,
        sort_order: sort_order || 0,
        icon: icon || "UtensilsCrossed",
        icon_color: icon_color || "#ffffff",
        type: type || "other",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Failed to create category:", error);
    return NextResponse.json(
      { error: "Failed to create category", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Failed GET /api/categories: Invalid or missing session`);
    return unauthorizedResponse();
  }

  console.log(`[API-AUTH] GET /api/categories - User: ${session.user_id}, Org: ${session.org_id}`);

  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    console.warn(`[API-RATELIMIT] Blocked GET /api/categories - User: ${session.user_id}, Org: ${session.org_id}`);
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log(`[API-CATEGORIES] Querying categories for org_id: ${session.org_id}`);
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, color, sort_order, description, icon, icon_color, type")
      .eq("org_id", session.org_id) // Use org_id from session
      .eq("is_active", true)
      .order("sort_order")
      .order("name");

    if (error) {
      console.error(`[API-CATEGORIES] Supabase error:`, error);
      throw error;
    }

    console.log(`[API-CATEGORIES] Successfully fetched ${data?.length || 0} categories`);
    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("[API-CATEGORIES] Failed to fetch categories:", error);
    console.error("[API-CATEGORIES] Error details:", error.message, error.code, error.hint);
    return NextResponse.json(
      { error: "Failed to fetch categories", details: error.message },
      { status: 500 }
    );
  }
}
