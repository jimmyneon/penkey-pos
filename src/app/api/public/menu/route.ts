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
        item_variants(id, name, price, is_default)
      `
      )
      .eq("org_id", PENKEY_ORG_ID)
      .eq("is_active", true)
      .order("name");

    if (error) throw error;

    console.log(`[PUBLIC-API] GET /api/public/menu - Found: ${data?.length || 0}`);
    return NextResponse.json(data || [], {
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
