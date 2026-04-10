export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { dataCache } from "@/lib/services/data-cache";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";
import { validateCSRF, csrfErrorResponse } from "@/lib/api/csrf-middleware";

export async function POST(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized POST /api/receipts/create`);
    return unauthorizedResponse();
  }

  // ✅ SECURITY: Validate CSRF token
  const csrfValid = await validateCSRF(request);
  if (!csrfValid) {
    console.warn(`[API-CSRF] Invalid CSRF token for POST /api/receipts/create`);
    return csrfErrorResponse();
  }

  console.log(`[API-AUTH] POST /api/receipts/create - User: ${session.user_id}, Org: ${session.org_id}`);

  // ✅ SECURITY: Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    console.warn(`[API-RATELIMIT] Blocked POST /api/receipts/create - User: ${session.user_id}`);
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const {
      id, // Temp receipt ID used as idempotency key
      lines,
      payment_method,
      cash_tendered,
      employee_id,
      register_id,
      org_id,
      store_id,
      customer_id,
      customer_name,
      customer_email,
      customer_phone,
      table_number,
      dining_option,
    } = await request.json();

    console.log('[Receipt Create] Incoming data:', { id, payment_method, employee_id, register_id, org_id, store_id, linesCount: lines?.length, dining_option });

    if (!lines || lines.length === 0) {
      return NextResponse.json({ error: "No items in cart" }, { status: 400 });
    }

    // ✅ SECURITY: Verify org_id matches session
    if (org_id !== session.org_id) {
      console.warn(`[API-AUTH] Org mismatch - Request: ${org_id}, Session: ${session.org_id}`);
      return unauthorizedResponse();
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify employee_id exists in org_members
    const { data: employee, error: employeeError } = await supabase
      .from("org_members")
      .select("id")
      .eq("id", employee_id)
      .eq("org_id", org_id)
      .maybeSingle();

    if (employeeError || !employee) {
      console.error('[Receipt Create] Employee validation failed:', employeeError, employee_id, org_id);
      return NextResponse.json({ error: "Invalid employee" }, { status: 400 });
    }
    console.log('[Receipt Create] Employee validated:', employee_id);

    // ✅ DUPLICATE PREVENTION: Check idempotency key before creating
    if (id) {
      const { data: existingReceipt } = await supabase
        .from("receipts")
        .select("id, receipt_number")
        .eq("idempotency_key", id)
        .maybeSingle();

      if (existingReceipt) {
        console.log("[Receipt Create] Duplicate detected via idempotency key, returning existing:", existingReceipt.id);
        return NextResponse.json({
          success: true,
          receipt_id: existingReceipt.id,
          receipt_number: (existingReceipt as any).receipt_number,
          duplicate: true,
        });
      }
    }

    // Sync customer record if provided
    if (customer_id && customer_name) {
      try {
        const nameParts = customer_name.trim().split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        await supabase.from("customers").upsert(
          {
            id: customer_id,
            org_id,
            first_name: firstName,
            last_name: lastName,
            email: customer_email || null,
            phone: customer_phone || null,
          },
          { onConflict: "id", ignoreDuplicates: false }
        );
      } catch (customerError) {
        console.error("[Receipt] Failed to sync customer:", customerError);
      }
    }

    // Calculate totals
    const subtotal = lines.reduce((sum: number, line: any) => {
      const modifiersTotal = line.modifiers.reduce((s: number, m: any) => s + m.price_adjustment, 0);
      return sum + (line.unit_price + modifiersTotal) * line.quantity;
    }, 0);

    const taxTotal = lines.reduce((sum: number, line: any) => {
      const modifiersTotal = line.modifiers.reduce((s: number, m: any) => s + m.price_adjustment, 0);
      return sum + (line.unit_price + modifiersTotal) * line.quantity * (line.tax_rate || 0);
    }, 0);

    const total = subtotal + taxTotal;

    // Get next receipt number
    const { data: receiptNumber } = await supabase.rpc("get_next_receipt_number", {
      p_register_id: register_id,
    });

    // Insert receipt
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .insert({
        org_id,
        store_id,
        register_id,
        member_id: employee_id,
        receipt_number: receiptNumber || 1,
        customer_id: customer_id || null,
        customer_name: customer_name || null,
        customer_email: customer_email || null,
        customer_phone: customer_phone || null,
        table_number: table_number || null,
        subtotal,
        discount_total: 0,
        tax_total: taxTotal,
        tip_total: 0,
        total,
        paid_amount: total,
        change_amount: payment_method === "cash" ? (cash_tendered || 0) - total : 0,
        status: "completed",
        dining_option: dining_option || "takeaway",
        idempotency_key: id || null,
      })
      .select()
      .single();

    if (receiptError) {
      console.error('[Receipt Create] Receipt insert failed:', receiptError);
      throw receiptError;
    }
    console.log('[Receipt Create] Receipt inserted:', (receipt as any).id);

    // Insert receipt lines
    const receiptLines = lines.map((line: any, index: number) => {
      const modifiersTotal = line.modifiers.reduce((s: number, m: any) => s + m.price_adjustment, 0);
      const lineSubtotal = (line.unit_price + modifiersTotal) * line.quantity;
      const lineTax = lineSubtotal * (line.tax_rate || 0);
      return {
        receipt_id: (receipt as any).id,
        org_id,
        item_id: line.item_id,
        variant_id: line.variant_id || null,
        name: line.item_name,
        quantity: line.quantity,
        unit_price: line.unit_price,
        discount_amount: 0,
        tax_rate: line.tax_rate || 0,
        tax_amount: lineTax,
        line_total: lineSubtotal + lineTax,
        modifiers: line.modifiers.length > 0 ? line.modifiers : null,
        notes: line.notes || null,
        sort_order: index,
      };
    });

    const { error: linesError } = await supabase.from("receipt_lines").insert(receiptLines);
    if (linesError) {
      console.error('[Receipt Create] Lines insert failed:', linesError);
      throw linesError;
    }
    console.log('[Receipt Create] Lines inserted:', receiptLines.length);

    // Insert payment record
    const { error: paymentError } = await supabase.from("payments").insert({
      receipt_id: (receipt as any).id,
      method: payment_method,
      amount: total,
      tip_amount: 0,
      reference: payment_method === "cash" ? `Cash tendered: ${cash_tendered}` : null,
    });
    if (paymentError) {
      console.error('[Receipt Create] Payment insert failed:', paymentError);
      throw paymentError;
    }
    console.log('[Receipt Create] Payment inserted for method:', payment_method);

    // Batch inventory deduction
    const itemIds = [...new Set(lines.map((l: any) => l.item_id))];
    const { data: items } = await supabase
      .from("items")
      .select("id, track_inventory")
      .in("id", itemIds);

    const trackedItems = new Map(
      (items || []).filter((i: any) => i.track_inventory).map((i: any) => [i.id, i])
    );

    if (trackedItems.size > 0) {
      const { data: inventoryLevels } = await supabase
        .from("inventory_levels")
        .select("id, item_id, variant_id, quantity")
        .eq("org_id", org_id)
        .in("item_id", Array.from(trackedItems.keys()));

      const inventoryMap = new Map(
        (inventoryLevels || []).map((inv: any) => [`${inv.item_id}_${inv.variant_id || "null"}`, inv])
      );

      const inventoryUpdates: any[] = [];
      const inventoryMovements: any[] = [];

      for (const line of lines) {
        if (!trackedItems.has(line.item_id)) continue;
        const key = `${line.item_id}_${line.variant_id || "null"}`;
        const level = inventoryMap.get(key);
        if (level) {
          inventoryUpdates.push({ id: level.id, quantity: level.quantity - line.quantity });
          inventoryMovements.push({
            org_id,
            item_id: line.item_id,
            variant_id: line.variant_id || null,
            quantity: -line.quantity,
            movement_type: "sale",
            reference_id: (receipt as any).id,
            notes: `Sale - Receipt #${(receipt as any).receipt_number}`,
          });
        }
      }

      await Promise.all(
        inventoryUpdates.map((u) =>
          supabase.from("inventory_levels").update({ quantity: u.quantity }).eq("id", u.id)
        )
      );

      if (inventoryMovements.length > 0) {
        await supabase.from("inventory_movements").insert(inventoryMovements);
      }
    }

    // Async cache invalidation (non-blocking)
    setImmediate(() => {
      dataCache.invalidatePopularItems(org_id);
      dataCache.invalidateDailyStats(org_id);
    });

    return NextResponse.json({
      success: true,
      receipt_id: (receipt as any).id,
      receipt_number: (receipt as any).receipt_number,
      total,
    });
  } catch (error: any) {
    console.error("[Receipt Create] Failed:", error);
    console.error("[Receipt Create] Error details:", {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
    const errorMessage = error?.message || "Failed to create receipt";
    return NextResponse.json({ error: errorMessage, code: error?.code }, { status: 500 });
  }
}
