import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-sumup-signature");
    const webhookSecret = process.env.SUMUP_WEBHOOK_SECRET;

    // Verify webhook signature (implement proper verification in production)
    if (!webhookSecret) {
      console.error("SUMUP_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 }
      );
    }

    // TODO: Implement proper HMAC signature verification
    // const crypto = require('crypto');
    // const expectedSignature = crypto
    //   .createHmac('sha256', webhookSecret)
    //   .update(body)
    //   .digest('hex');
    // 
    // if (signature !== expectedSignature) {
    //   return NextResponse.json(
    //     { error: "Invalid signature" },
    //     { status: 401 }
    //   );
    // }

    const payload = JSON.parse(body);
    console.log("[SumUp Webhook] Received payload:", payload);

    // Handle different event types
    switch (payload.event_type) {
      case "PAYMENT_SUCCESSFUL":
        await handlePaymentSuccessful(payload);
        break;
      
      case "PAYMENT_FAILED":
        await handlePaymentFailed(payload);
        break;
      
      case "REFUND_SUCCESSFUL":
        await handleRefundSuccessful(payload);
        break;
      
      case "REFUND_FAILED":
        await handleRefundFailed(payload);
        break;
      
      default:
        console.log("[SumUp Webhook] Unknown event type:", payload.event_type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[SumUp Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function handlePaymentSuccessful(payload: any) {
  const { data } = payload;
  
  try {
    // Update receipt with payment details
    const { error } = await supabase
      .from("receipts")
      .update({
        payment_method: "card",
        transaction_id: data.transaction_id,
        card_type: data.card?.type,
        card_last4: data.card?.last_4_digits,
        payment_status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", data.foreign_transaction_id);

    if (error) {
      console.error("[SumUp Webhook] Failed to update receipt:", error);
    } else {
      console.log("[SumUp Webhook] Receipt updated successfully:", data.foreign_transaction_id);
    }
  } catch (error) {
    console.error("[SumUp Webhook] Error handling successful payment:", error);
  }
}

async function handlePaymentFailed(payload: any) {
  const { data } = payload;
  
  try {
    // Update receipt with failed payment status
    const { error } = await supabase
      .from("receipts")
      .update({
        payment_method: "card",
        transaction_id: data.transaction_id,
        payment_status: "failed",
        payment_error: payload.message || "Payment failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.foreign_transaction_id);

    if (error) {
      console.error("[SumUp Webhook] Failed to update receipt for failed payment:", error);
    } else {
      console.log("[SumUp Webhook] Receipt updated for failed payment:", data.foreign_transaction_id);
    }
  } catch (error) {
    console.error("[SumUp Webhook] Error handling failed payment:", error);
  }
}

async function handleRefundSuccessful(payload: any) {
  const { data } = payload;
  
  try {
    // Create refund record
    const { error } = await supabase
      .from("refunds")
      .insert({
        receipt_id: data.foreign_transaction_id,
        transaction_id: data.transaction_id,
        amount: data.amount / 100, // Convert from minor units
        currency: data.currency,
        status: "successful",
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error("[SumUp Webhook] Failed to create refund record:", error);
    } else {
      console.log("[SumUp Webhook] Refund record created:", data.transaction_id);
    }
  } catch (error) {
    console.error("[SumUp Webhook] Error handling successful refund:", error);
  }
}

async function handleRefundFailed(payload: any) {
  const { data } = payload;
  
  try {
    // Create failed refund record
    const { error } = await supabase
      .from("refunds")
      .insert({
        receipt_id: data.foreign_transaction_id,
        transaction_id: data.transaction_id,
        amount: data.amount / 100, // Convert from minor units
        currency: data.currency,
        status: "failed",
        error_message: payload.message || "Refund failed",
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error("[SumUp Webhook] Failed to create failed refund record:", error);
    } else {
      console.log("[SumUp Webhook] Failed refund record created:", data.transaction_id);
    }
  } catch (error) {
    console.error("[SumUp Webhook] Error handling failed refund:", error);
  }
}
