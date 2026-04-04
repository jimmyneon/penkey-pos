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
    .select("org_id")
    .eq("id", itemId)
    .single();

  if (error || !item) {
    return { error: "Item not found or error fetching", status: 404 };
  }

  if (item.org_id !== orgId) {
    return { error: "Access denied", status: 403 };
  }

  return { error: null };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = (await params).id;
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Failed PATCH /api/items/${id}: Invalid or missing session`);
    return unauthorizedResponse();
  }
  console.log(`[API-AUTH] PATCH /api/items/${id} - User: ${session.user_id}, Org: ${session.org_id}`);

  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    console.warn(`[API-RATELIMIT] Blocked PATCH /api/items/${id} - User: ${session.user_id}, Org: ${session.org_id}`);
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

    const body = await request.json();
    const {
      name,
      description,
      price,
      base_price,
      cost,
      sku,
      barcode,
      category_id,
      tax_id,
      is_active,
      track_stock,
      stock_quantity,
      low_stock_threshold,
      image_url,
    } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    // Map 'price' to 'base_price' for compatibility
    if (price !== undefined) updateData.base_price = price;
    if (base_price !== undefined) updateData.base_price = base_price;
    if (cost !== undefined) updateData.cost = cost;
    if (sku !== undefined) updateData.sku = sku;
    if (barcode !== undefined) updateData.barcode = barcode;
    // Convert empty string to null for category_id (UUID foreign key)
    if (category_id !== undefined) updateData.category_id = category_id === "" ? null : category_id;
    if (tax_id !== undefined) updateData.tax_class_id = tax_id;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (track_stock !== undefined) updateData.track_inventory = track_stock;
    if (stock_quantity !== undefined) updateData.stock_quantity = stock_quantity;
    if (low_stock_threshold !== undefined)
      updateData.low_stock_threshold = low_stock_threshold;
    if (image_url !== undefined) updateData.image_url = image_url;

    console.log(`[API-AUTH] Updating item ${id} with data:`, updateData);

    const { data, error } = await supabase
      .from("items")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    console.log(`[API-AUTH] Supabase returned after update:`, data);

    if (error) throw error;

    console.log(`[API-AUTH] Successful PATCH /api/items/${id} - User: ${session.user_id}, Org: ${session.org_id}`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Failed to update item:", error);
    return NextResponse.json(
      { error: "Failed to update item", details: error.message },
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
    console.warn(`[API-AUTH] Failed DELETE /api/items/${id}: Invalid or missing session`);
    return unauthorizedResponse();
  }
  console.log(`[API-AUTH] DELETE /api/items/${id} - User: ${session.user_id}, Org: ${session.org_id}`);

  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    console.warn(`[API-RATELIMIT] Blocked DELETE /api/items/${id} - User: ${session.user_id}, Org: ${session.org_id}`);
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

    // Soft delete
    const { error } = await supabase
      .from("items")
      .update({ is_active: false })
      .eq("id", id);

    if (error) throw error;

    console.log(`[API-AUTH] Successful DELETE /api/items/${id} - User: ${session.user_id}, Org: ${session.org_id}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete item:", error);
    return NextResponse.json(
      { error: "Failed to delete item", details: error.message },
      { status: 500 }
    );
  }
}
