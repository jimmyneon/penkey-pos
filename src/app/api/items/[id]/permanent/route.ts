export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { unauthorizedResponse, validatePOSSession } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

async function verifyItemOwnership(
  supabase: any,
  itemId: string,
  orgId: string
) {
  const { data: item, error } = await supabase
    .from("items")
    .select("org_id, image_url")
    .eq("id", itemId)
    .single();

  if (error || !item) {
    return { error: "Item not found or error fetching", status: 404, item: null };
  }

  if (item.org_id !== orgId) {
    return { error: "Access denied", status: 403, item: null };
  }

  return { error: null, item };
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = (await params).id;
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Failed DELETE /api/items/${id}/permanent: Invalid or missing session`);
    return unauthorizedResponse();
  }
  console.log(`[API-AUTH] DELETE /api/items/${id}/permanent - User: ${session.user_id}, Org: ${session.org_id}`);

  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    console.warn(`[API-RATELIMIT] Blocked DELETE /api/items/${id}/permanent - User: ${session.user_id}, Org: ${session.org_id}`);
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const ownershipCheck = await verifyItemOwnership(
      supabase,
      id,
      session.org_id
    );
    if (ownershipCheck.error) {
      if (ownershipCheck.status === 403) {
        console.warn(`[API-AUTH] Cross-tenant access attempt: User ${session.user_id} in Org ${session.org_id} tried to access item ${id}`);
      }
      return NextResponse.json(
        { error: ownershipCheck.error },
        { status: ownershipCheck.status }
      );
    }

    // Hard delete from database
    const { error } = await supabase
      .from("items")
      .delete()
      .eq("id", id);

    if (error) throw error;

    // Delete associated images from R2 if they exist
    if (ownershipCheck.item?.image_url) {
      try {
        const { deleteFromR2 } = await import('@/lib/services/r2-upload');
        // Try both formats since we don't store format in DB
        await deleteFromR2(session.org_id, id, 'webp').catch(() => {});
        await deleteFromR2(session.org_id, id, 'jpeg').catch(() => {});
        console.log(`[API-AUTH] Deleted images for item ${id}`);
      } catch (imgError) {
        // Log but don't fail the delete if image deletion fails
        console.warn(`[API-AUTH] Failed to delete images for item ${id}:`, imgError);
      }
    }

    console.log(`[API-AUTH] Successful permanent DELETE /api/items/${id} - User: ${session.user_id}, Org: ${session.org_id}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to permanently delete item:", error);
    return NextResponse.json(
      { error: "Failed to delete item", details: error.message },
      { status: 500 }
    );
  }
}
