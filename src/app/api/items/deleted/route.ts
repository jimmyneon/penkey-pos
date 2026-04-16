export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { unauthorizedResponse, validatePOSSession } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Failed GET /api/items/deleted: Invalid or missing session`);
    return unauthorizedResponse();
  }

  console.log(`[API-AUTH] GET /api/items/deleted - User: ${session.user_id}, Org: ${session.org_id}`);

  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    console.warn(`[API-RATELIMIT] Blocked GET /api/items/deleted - User: ${session.user_id}, Org: ${session.org_id}`);
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
        category_id,
        base_price,
        image_url,
        sku,
        updated_at,
        categories(name, color)
      `
      )
      .eq("org_id", session.org_id)
      .eq("is_active", false)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    console.log(`[API-AUTH] Successful GET /api/items/deleted - User: ${session.user_id}, Org: ${session.org_id}, Found: ${data?.length || 0}`);
    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("Failed to fetch deleted items:", error);
    return NextResponse.json(
      { error: "Failed to fetch deleted items" },
      { status: 500 }
    );
  }
}
