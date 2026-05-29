export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { ratelimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  // IP-based rate limiting for public endpoint
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    console.warn(`[PUBLIC-API] Rate limited GET /api/public/categories - IP: ${ip}`);
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("org_id");

    if (!orgId) {
      return NextResponse.json(
        { error: "org_id query parameter is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("categories")
      .select("id, name, color, sort_order")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("sort_order")
      .order("name");

    if (error) throw error;

    console.log(`[PUBLIC-API] GET /api/public/categories - Org: ${orgId}, Found: ${data?.length || 0}`);
    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("[PUBLIC-API] Failed to fetch categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
