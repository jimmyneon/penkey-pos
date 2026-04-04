import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { unauthorizedResponse, validatePOSSession } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = (await params).id;
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Failed PATCH /api/categories/${id}: Invalid or missing session`);
    return unauthorizedResponse();
  }

  console.log(`[API-AUTH] PATCH /api/categories/${id} - User: ${session.user_id}, Org: ${session.org_id}`);

  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    console.warn(`[API-RATELIMIT] Blocked PATCH /api/categories/${id} - User: ${session.user_id}, Org: ${session.org_id}`);
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify the category belongs to the user's org
    const { data: categoryData, error: fetchError } = await supabase
      .from("categories")
      .select("org_id")
      .eq("id", id)
      .single();

    if (fetchError || !categoryData) {
      return NextResponse.json(
        { error: "Category not found or error fetching" },
        { status: 404 }
      );
    }

    const category = categoryData as { org_id: string };

    if (category.org_id !== session.org_id) {
      console.warn(`[API-AUTH] Cross-tenant access attempt: User ${session.user_id} in Org ${session.org_id} tried to access category ${id} in Org ${category.org_id}`);
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const { name, color, description, is_active } = body;

    // Proceed with update
    const { data, error } = await supabase
      .from("categories")
      .update({
        name,
        color,
        description,
        is_active,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    console.log(`[API-AUTH] Successful PATCH /api/categories/${id} - User: ${session.user_id}, Org: ${session.org_id}`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Failed to update category:", error);
    return NextResponse.json(
      { error: "Failed to update category", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = (await params).id;
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Failed DELETE /api/categories/${id}: Invalid or missing session`);
    return unauthorizedResponse();
  }

  console.log(`[API-AUTH] DELETE /api/categories/${id} - User: ${session.user_id}, Org: ${session.org_id}`);

  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    console.warn(`[API-RATELIMIT] Blocked DELETE /api/categories/${id} - User: ${session.user_id}, Org: ${session.org_id}`);
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify the category belongs to the user's org
    const { data: categoryData, error: fetchError } = await supabase
      .from("categories")
      .select("org_id")
      .eq("id", id)
      .single();

    if (fetchError || !categoryData) {
      return NextResponse.json(
        { error: "Category not found or error fetching" },
        { status: 404 }
      );
    }

    const category = categoryData as { org_id: string };

    if (category.org_id !== session.org_id) {
      console.warn(`[API-AUTH] Cross-tenant access attempt: User ${session.user_id} in Org ${session.org_id} tried to access category ${id} in Org ${category.org_id}`);
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Soft delete
    const { error } = await supabase
      .from("categories")
      .update({ is_active: false })
      .eq("id", id);

    if (error) throw error;

    console.log(`[API-AUTH] Successful DELETE /api/categories/${id} - User: ${session.user_id}, Org: ${session.org_id}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete category:", error);
    return NextResponse.json(
      { error: "Failed to delete category", details: error.message },
      { status: 500 }
    );
  }
}
