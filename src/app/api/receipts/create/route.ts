export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { dataCache } from "@/lib/services/data-cache";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

// Helper to check if a string is a valid UUID format
function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Convert any string to a deterministic UUID v5 (for temp IDs)
function stringToUUID(str: string): string {
  // Use a simple hash to create a deterministic UUID
  // This ensures the same temp ID always generates the same UUID
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(str).digest('hex');
  // Format as UUID v5
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
}
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
    const body = await request.json();
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
      customer_count,
      payment_provider,
      transaction_id,
      checkout_id,
      created_at,
      tip_amount,
      voucher_redemptions, // Array of voucher redemptions
      discount_code,
      discount_amount,
    } = body;

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

    // ✅ DUPLICATE PREVENTION: For card payments, check if transaction_id already exists in payments table
    if (payment_method === 'card' && transaction_id && payment_provider === 'sumup') {
      console.log("[Receipt Create] Checking for existing receipt with SumUp transaction_id:", transaction_id);
      const { data: existingPayment, error: paymentError } = await supabase
        .from("payments")
        .select("receipt_id")
        .eq("metadata->>transaction_id", transaction_id)
        .maybeSingle();

      if (!paymentError && existingPayment) {
        console.log("[Receipt Create] Duplicate SumUp transaction detected, returning existing receipt:", existingPayment.receipt_id);
        return NextResponse.json({
          success: true,
          receipt_id: existingPayment.receipt_id,
          duplicate: true,
          reason: "SumUp transaction already processed",
        });
      }
    }

    // ✅ DUPLICATE PREVENTION: Check idempotency key before creating
    if (id) {
      console.log("[Receipt Create] Checking idempotency key:", id);
      try {
        const { data: existingReceipt, error: idempotencyError } = await supabase
          .from("receipts")
          .select("id, receipt_number")
          .eq("idempotency_key", id)
          .maybeSingle();

        if (idempotencyError) {
          console.error("[Receipt Create] Idempotency check failed - column might not exist:", idempotencyError);
          // Continue without idempotency check
        } else if (existingReceipt) {
          console.log("[Receipt Create] Duplicate detected via idempotency key, returning existing:", existingReceipt.id);
          return NextResponse.json({
            success: true,
            receipt_id: existingReceipt.id,
            receipt_number: (existingReceipt as any).receipt_number,
            duplicate: true,
          });
        }
      } catch (idempotencyError) {
        console.error("[Receipt Create] Idempotency check exception:", idempotencyError);
        // Continue without idempotency check
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

    const tipTotal = parseFloat(tip_amount) || 0;
    const total = subtotal + taxTotal + tipTotal;

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
        tip_total: tipTotal,
        tip_amount: tipTotal,
        total,
        paid_amount: total,
        change_amount: payment_method === "cash" ? (cash_tendered || 0) - total : 0,
        status: "completed",
        dining_option: dining_option || "takeaway",
        customer_count: parseInt(customer_count) || 1,
        discount_code: discount_code || null,
        discount_amount: parseFloat(discount_amount) || 0,
        idempotency_key: id ? (isValidUUID(id) ? id : stringToUUID(id)) : null,
        // Preserve original transaction time if provided (offline sync), otherwise use database default
        created_at: created_at || undefined,
      })
      .select()
      .single();

    if (receiptError) {
      console.error('[Receipt Create] Receipt insert failed:', receiptError);
      throw receiptError;
    }
    const newReceiptId = (receipt as any).id;
    console.log('[Receipt Create] Receipt inserted:', newReceiptId);

    // ✅ ATOMICITY: From this point on, any failure must roll back the receipt
    // row so the next outbox retry (which uses the same idempotency_key) can
    // create the receipt cleanly. Without this rollback, a partial insert
    // (receipt with no lines/payment) would be permanently locked in by the
    // idempotency check at the top of this handler.
    const rollbackReceipt = async (reason: string, err: any) => {
      console.error(`[Receipt Create] Rolling back receipt ${newReceiptId} - reason: ${reason}`, err);
      try {
        // Delete child rows first (no-op if none inserted yet, safe regardless of FK CASCADE settings)
        await supabase.from("payments").delete().eq("receipt_id", newReceiptId);
        await supabase.from("receipt_lines").delete().eq("receipt_id", newReceiptId);
        await supabase.from("receipts").delete().eq("id", newReceiptId);
        console.log(`[Receipt Create] Rollback complete for ${newReceiptId}`);
      } catch (rollbackError) {
        console.error(`[Receipt Create] CRITICAL: rollback failed for ${newReceiptId}:`, rollbackError);
      }
    };

    // Insert receipt lines
    const receiptLines = lines.map((line: any, index: number) => {
      const modifiersTotal = line.modifiers.reduce((s: number, m: any) => s + m.price_adjustment, 0);
      const lineSubtotal = (line.unit_price + modifiersTotal) * line.quantity;
      const lineTax = lineSubtotal * (line.tax_rate || 0);
      return {
        receipt_id: newReceiptId,
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
      await rollbackReceipt('lines insert failed', linesError);
      throw linesError;
    }
    console.log('[Receipt Create] Lines inserted:', receiptLines.length);

    // Insert payment record
    const paymentData: any = {
      receipt_id: newReceiptId,
      method: payment_method,
      amount: total,
      tip_amount: tipTotal,
      reference: payment_method === "cash" ? `Cash tendered: ${cash_tendered}` : null,
    };

    // Store SumUp metadata in payments table for refunds
    if (payment_method === "card") {
      paymentData.metadata = {
        payment_provider: body.payment_provider,
        transaction_id: body.transaction_id,
        checkout_id: body.checkout_id,
      };
    }

    const { error: paymentError } = await supabase.from("payments").insert(paymentData);
    if (paymentError) {
      console.error('[Receipt Create] Payment insert failed:', paymentError);
      await rollbackReceipt('payment insert failed', paymentError);
      throw paymentError;
    }
    console.log('[Receipt Create] Payment inserted for method:', payment_method);

    // Insert voucher redemptions if any
    if (voucher_redemptions && voucher_redemptions.length > 0) {
      const voucherRedemptionRecords = voucher_redemptions.map((vr: any) => ({
        org_id,
        receipt_id: newReceiptId,
        voucher_id: vr.voucher_id,
        voucher_name: vr.voucher_name,
        discount_type: vr.discount_type,
        discount_value: vr.discount_value,
        bean_cost: vr.bean_cost,
        item_type: vr.item_type || null,
        category: vr.category || null,
        customer_id: customer_id || null,
        customer_name: customer_name || null,
        staff_id: employee_id,
      }));

      const { error: voucherError } = await supabase.from("voucher_redemptions").insert(voucherRedemptionRecords);
      if (voucherError) {
        console.error('[Receipt Create] Voucher redemptions insert failed:', voucherError);
        // Don't rollback - voucher tracking is non-critical
      } else {
        console.log('[Receipt Create] Voucher redemptions inserted:', voucherRedemptionRecords.length);
      }
    }

    // Increment discount usage count if a discount code was applied
    if (discount_code) {
      try {
        const { data: disc } = await (supabase.from('discounts') as any)
          .select('id, usage_count')
          .eq('code', discount_code)
          .eq('org_id', org_id)
          .maybeSingle();
        if (disc) {
          await (supabase.from('discounts') as any)
            .update({ usage_count: (disc.usage_count || 0) + 1 })
            .eq('id', disc.id);
        }
      } catch (e) {
        console.error('[Receipt Create] Failed to increment discount usage:', e);
      }
    }

    // Batch inventory deduction
    // NOTE: Inventory failures DO NOT roll back the receipt. Sales must always
    // be recorded; inventory tracking is best-effort and can be reconciled later.
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
