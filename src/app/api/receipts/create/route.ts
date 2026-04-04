import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { dataCache } from "@/lib/services/data-cache";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";
import { validateCSRF, csrfErrorResponse } from "@/lib/api/csrf-middleware";
import { createPerksApiClient } from "@penkey/perks-integration";

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

  // ✅ SECURITY: Log the action
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
      employee_id, // This is actually member_id
      register_id,
      org_id,
      store_id,
      // Customer data from enhanced assign ticket
      customer_id,
      customer_name,
      customer_email,
      customer_phone,
      table_number,
    } = await request.json();

    if (!lines || lines.length === 0) {
      return NextResponse.json(
        { error: "No items in cart" },
        { status: 400 }
      );
    }

    // ✅ SECURITY: Verify org_id matches session
    if (org_id !== session.org_id) {
      console.warn(`[API-AUTH] Org mismatch - Request: ${org_id}, Session: ${session.org_id}`);
      return unauthorizedResponse();
    }

    // Create Supabase client with service role key
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Check if receipt already exists with this idempotency key
    if (id) {
      const { data: existingReceipt } = await supabase
        .from('receipts')
        .select('id')
        .eq('idempotency_key', id)
        .maybeSingle();
      
      if (existingReceipt) {
        console.log('[Receipt Create] Duplicate receipt detected, returning existing:', existingReceipt.id);
        return NextResponse.json({ 
          receipt_id: existingReceipt.id,
          duplicate: true 
        });
      }
    }

    // If customer_id is provided, ensure customer exists in POS customers table
    if (customer_id && customer_name) {
      try {
        // Split name into first and last
        const nameParts = customer_name.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        await supabase
          .from("customers")
          .upsert({
            id: customer_id,
            org_id,
            first_name: firstName,
            last_name: lastName,
            email: customer_email || null,
            phone: customer_phone || null,
          }, {
            onConflict: 'id',
            ignoreDuplicates: false, // Update if exists
          });
        
        console.log(`[Receipt] Synced customer ${customer_id} (${customer_name}) to POS customers table`);
      } catch (customerError) {
        console.error('[Receipt] Failed to sync customer:', customerError);
        // Don't fail receipt creation if customer sync fails
      }
    }

    // Calculate totals
    const subtotal = lines.reduce((sum: number, line: any) => {
      const lineTotal = line.unit_price * line.quantity;
      const modifiersTotal =
        line.modifiers.reduce((modSum: number, mod: any) => modSum + mod.price_adjustment, 0) *
        line.quantity;
      return sum + lineTotal + modifiersTotal;
    }, 0);

    const tax = lines.reduce((sum: number, line: any) => {
      const lineTotal = line.unit_price * line.quantity;
      const modifiersTotal =
        line.modifiers.reduce((modSum: number, mod: any) => modSum + mod.price_adjustment, 0) *
        line.quantity;
      return sum + (lineTotal + modifiersTotal) * line.tax_rate;
    }, 0);

    const total = subtotal + tax;

    // Get next receipt number
    const { data: receiptNumber } = await supabase.rpc("get_next_receipt_number", {
      p_register_id: register_id,
    });

    // Create receipt
    const receiptInsertData = {
      org_id,
      store_id,
      register_id,
      member_id: employee_id, // Column is named member_id in schema
      receipt_number: receiptNumber || 1,
      // Customer data from enhanced assign ticket
      customer_id: customer_id || null,
      customer_name: customer_name || null,
      customer_email: customer_email || null,
      customer_phone: customer_phone || null,
      table_number: table_number || null,
      subtotal,
      discount_total: 0,
      tax_total: tax, // Column is named tax_total in schema
      tip_total: 0,
      total,
      paid_amount: total, // Required field
      change_amount: payment_method === "cash" ? cash_tendered - total : 0,
      status: "completed",
      dining_option: "takeaway",
      idempotency_key: id || null, // Use temp receipt ID as idempotency key
    };
    
    console.log('[Receipt Create] Inserting receipt with customer data:', {
      customer_id: receiptInsertData.customer_id,
      customer_name: receiptInsertData.customer_name,
    });
    
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .insert(receiptInsertData)
      .select()
      .single();
    
    console.log('[Receipt Create] Receipt created:', {
      id: (receipt as any)?.id,
      customer_id: (receipt as any)?.customer_id,
      customer_name: (receipt as any)?.customer_name,
    });

    if (receiptError) throw receiptError;

    // Create receipt lines
    const receiptLines = lines.map((line: any, index: number) => {
      const modifiersTotal = line.modifiers.reduce((sum: number, m: any) => sum + m.price_adjustment, 0);
      const lineSubtotal = (line.unit_price + modifiersTotal) * line.quantity;
      const lineTax = lineSubtotal * line.tax_rate;
      
      return {
        receipt_id: (receipt as any).id,
        org_id,
        item_id: line.item_id,
        variant_id: line.variant_id,
        name: line.item_name, // Required: item name snapshot
        quantity: line.quantity,
        unit_price: line.unit_price,
        discount_amount: 0, // Required: default to 0
        tax_rate: line.tax_rate,
        tax_amount: lineTax, // Required: calculated tax amount
        line_total: lineSubtotal + lineTax,
        modifiers: line.modifiers.length > 0 ? line.modifiers : null,
        notes: line.notes || null,
        sort_order: index,
      };
    });

    console.log("Inserting receipt lines:", JSON.stringify(receiptLines, null, 2));
    
    const { data: insertedLines, error: linesError } = await supabase
      .from("receipt_lines")
      .insert(receiptLines)
      .select();

    if (linesError) {
      console.error("Failed to insert receipt lines:", linesError);
      throw linesError;
    }
    
    console.log("Successfully inserted lines:", insertedLines?.length);

    // Create payment record
    const { error: paymentError } = await supabase
      .from("payments")
      .insert({
        receipt_id: (receipt as any).id,
        method: payment_method, // Column is named 'method' not 'payment_method'
        amount: total,
        tip_amount: 0,
        reference: payment_method === "cash" ? `Cash tendered: ${cash_tendered}` : null,
      });

    if (paymentError) throw paymentError;

    // Batch inventory operations for better performance
    const itemIds = [...new Set(lines.map((l: any) => l.item_id))];
    
    // Get all items in one query
    const { data: items } = await supabase
      .from("items")
      .select("id, track_inventory")
      .in("id", itemIds);

    const trackedItems = new Map(
      (items || []).filter((i: any) => i.track_inventory).map((i: any) => [i.id, i])
    );

    if (trackedItems.size > 0) {
      // Get all inventory levels in one query
      const { data: inventoryLevels } = await supabase
        .from("inventory_levels")
        .select("id, item_id, variant_id, quantity")
        .eq("org_id", org_id)
        .in("item_id", Array.from(trackedItems.keys()));

      const inventoryMap = new Map(
        (inventoryLevels || []).map((inv: any) => [
          `${inv.item_id}_${inv.variant_id || 'null'}`,
          inv
        ])
      );

      // Prepare batch updates and inserts
      const inventoryUpdates: any[] = [];
      const inventoryMovements: any[] = [];

      for (const line of lines) {
        if (!trackedItems.has(line.item_id)) continue;

        const key = `${line.item_id}_${line.variant_id || 'null'}`;
        const inventoryLevel = inventoryMap.get(key);

        if (inventoryLevel) {
          const newQuantity = inventoryLevel.quantity - line.quantity;
          inventoryUpdates.push({
            id: inventoryLevel.id,
            quantity: newQuantity
          });

          inventoryMovements.push({
            org_id,
            item_id: line.item_id,
            variant_id: line.variant_id,
            quantity: -line.quantity,
            movement_type: "sale",
            reference_id: (receipt as any).id,
            notes: `Sale - Receipt #${(receipt as any).receipt_number}`,
          });
        }
      }

      // Batch update inventory levels in parallel
      if (inventoryUpdates.length > 0) {
        await Promise.all(
          inventoryUpdates.map(update =>
            supabase
              .from("inventory_levels")
              .update({ quantity: update.quantity })
              .eq("id", update.id)
          )
        );
      }

      // Batch insert inventory movements
      if (inventoryMovements.length > 0) {
        await supabase
          .from("inventory_movements")
          .insert(inventoryMovements);
      }
    }

    // Award points to customer if assigned
    if (customer_id) {
      try {
        const perksApi = createPerksApiClient();
        const pointsToAward = Math.floor(total); // 1 point per £1
        
        await perksApi.awardPoints(
          customer_id,
          pointsToAward,
          (receipt as any).id,
          `Purchase points: Receipt ${(receipt as any).receipt_number}`
        );
        
        console.log(`[Receipt] Awarded ${pointsToAward} points to customer ${customer_id}`);
      } catch (error) {
        console.error('[Receipt] Failed to award points:', error);
        // Don't fail the receipt creation - points can be awarded manually
      }
    }

    // Defer cache invalidation to avoid blocking response
    // This runs asynchronously after the response is sent
    setImmediate(() => {
      console.log("[Receipt] Invalidating cache for org:", org_id);
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
    console.error("Failed to create receipt:", error);
    return NextResponse.json(
      { error: "Failed to create receipt" },
      { status: 500 }
    );
  }
}
