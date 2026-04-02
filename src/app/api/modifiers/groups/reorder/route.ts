import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@penkey/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";
import { validateCSRF, csrfErrorResponse } from "@/lib/api/csrf-middleware";

export async function POST(request: NextRequest) {
  // Validate session
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized POST /api/modifiers/groups/reorder`);
    return unauthorizedResponse();
  }

  // CSRF
  const csrfValid = await validateCSRF(request);
  if (!csrfValid) {
    console.warn(`[API-CSRF] Invalid CSRF token for POST /api/modifiers/groups/reorder`);
    return csrfErrorResponse();
  }

  // Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const body = await request.json();
    const { groups } = body as { groups: Array<{ id: string; sort_order: number }> };

    if (!Array.isArray(groups)) {
      return NextResponse.json({ error: "groups must be an array" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Update each group's sort_order
    const updates = groups.map((g) =>
      supabase
        .from("modifier_groups")
        .update({ sort_order: g.sort_order })
        .eq("id", g.id)
        .eq("org_id", session.org_id)
    );

    const results = await Promise.all(updates);
    const error = results.find((r) => (r as any).error)?.error;
    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message || "Failed to reorder" }, { status: 500 });
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
