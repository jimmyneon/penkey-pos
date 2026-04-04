import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";
import { validateCSRF, csrfErrorResponse } from "@/lib/api/csrf-middleware";

export async function POST(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized POST /api/modifiers/options/reorder`);
    return unauthorizedResponse();
  }

  // ✅ SECURITY: Validate CSRF token
  const csrfValid = await validateCSRF(request);
  if (!csrfValid) {
    console.warn(`[API-CSRF] Invalid CSRF token for POST /api/modifiers/options/reorder`);
    return csrfErrorResponse();
  }

  // ✅ SECURITY: Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const body = await request.json();
    const { options } = body;

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Update each option's sort_order
    const updates = options.map((opt: { id: string; sort_order: number }) =>
      supabase
        .from("modifier_options")
        .update({ sort_order: opt.sort_order })
        .eq("id", opt.id)
    );

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
