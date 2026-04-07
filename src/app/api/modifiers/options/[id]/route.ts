export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { validateCSRF, csrfErrorResponse } from "@/lib/api/csrf-middleware";
import { ratelimit } from "@/lib/ratelimit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized PATCH /api/modifiers/options/[id]`);
    return unauthorizedResponse();
  }

  // ✅ SECURITY: Validate CSRF token
  const csrfValid = await validateCSRF(request);
  if (!csrfValid) {
    console.warn(`[API-CSRF] Invalid CSRF token for PATCH /api/modifiers/options/[id]`);
    return csrfErrorResponse();
  }

  // ✅ SECURITY: Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const { id } = await params;
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    const { name, price_adjustment } = body;

    // Verify the modifier option belongs to the user's organization
    const { data: option, error: optionError } = await supabase
      .from("modifier_options")
      .select("modifier_groups(org_id)")
      .eq("id", id)
      .single();

    if (optionError || !option) {
      return NextResponse.json({ error: "Modifier option not found" }, { status: 404 });
    }

    const optionOrgId = (option as any).modifier_groups?.org_id;
    if (optionOrgId !== session.org_id) {
      console.warn(`[API-AUTH] Cross-tenant access attempt: User ${session.user_id} in Org ${session.org_id} tried to update option ${id} in Org ${optionOrgId}`);
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { error } = await supabase
      .from("modifier_options")
      .update({
        name,
        price_adjustment,
      })
      .eq("id", id);

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized DELETE /api/modifiers/options/[id]`);
    return unauthorizedResponse();
  }

  // ✅ SECURITY: Validate CSRF token
  const csrfValid = await validateCSRF(request);
  if (!csrfValid) {
    console.warn(`[API-CSRF] Invalid CSRF token for DELETE /api/modifiers/options/[id]`);
    return csrfErrorResponse();
  }

  // ✅ SECURITY: Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const { id } = await params;
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify the modifier option belongs to the user's organization
    const { data: option, error: optionError } = await supabase
      .from("modifier_options")
      .select("modifier_groups(org_id)")
      .eq("id", id)
      .single();

    if (optionError || !option) {
      return NextResponse.json({ error: "Modifier option not found" }, { status: 404 });
    }

    const optionOrgId = (option as any).modifier_groups?.org_id;
    if (optionOrgId !== session.org_id) {
      console.warn(`[API-AUTH] Cross-tenant access attempt: User ${session.user_id} in Org ${session.org_id} tried to delete option ${id} in Org ${optionOrgId}`);
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { error } = await supabase
      .from("modifier_options")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
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
