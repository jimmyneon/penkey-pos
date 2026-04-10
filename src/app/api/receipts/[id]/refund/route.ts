export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: receiptId } = await params;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Database configuration missing" },
        { status: 500 }
      );
    }

    const supabase = createSupabaseServerClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();
    const { amount, reason, selectedItems, memberId, orgId } = body;

    if (!amount || !reason || !memberId || !orgId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get receipt details including payment info
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select("id, receipt_number, total, refunded_amount, status, payment_method, payment_provider, transaction_id")
      .eq("id", receiptId)
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json(
        { error: "Receipt not found" },
        { status: 404 }
      );
    }

    // Get payments
    const { data: payments } = await supabase
      .from("payments")
      .select("method, amount, reference")
      .eq("receipt_id", receiptId);

    // Get receipt lines
    const { data: lines } = await supabase
      .from("receipt_lines")
      .select("id, name, quantity, line_total")
      .eq("receipt_id", receiptId);

    if (receiptError || !receipt) {
      return NextResponse.json(
        { error: "Receipt not found" },
        { status: 404 }
      );
    }

    // Validate refund amount
    const remainingAmount = (receipt as any).total - (receipt as any).refunded_amount;
    if (amount > remainingAmount) {
      return NextResponse.json(
        { error: "Refund amount exceeds remaining balance" },
        { status: 400 }
      );
    }

    // Generate refund number
    const refundNumber = `REF-${(receipt as any).receipt_number}-${Date.now()}`;

    // Prepare refund lines
    let refundLines: any[] = [];
    if (selectedItems && selectedItems.length > 0 && lines) {
      // Partial refund - specific items
      refundLines = lines
        .filter((line: any) => selectedItems.includes(line.id))
        .map((line: any) => ({
          ticket_line_id: line.id,
          name: line.name,
          quantity: line.quantity,
          amount: line.line_total,
        }));
    } else if (lines) {
      // Full refund - all items
      refundLines = lines.map((line: any) => ({
        ticket_line_id: line.id,
        name: line.name,
        quantity: line.quantity,
        amount: line.line_total,
      }));
    }

    // Get primary payment method
    const primaryPayment = payments && payments[0] ? (payments[0] as any) : { method: "cash", reference: null };

    // If payment was via SumUp card, process refund through SumUp API first
    const receiptData = receipt as any;
    if (receiptData.payment_method === 'card' && receiptData.payment_provider === 'sumup' && receiptData.transaction_id) {
      try {
        console.log('[Refund] Processing SumUp refund for transaction:', receiptData.transaction_id);
        
        const sumupRefundRes = await fetch(`${request.nextUrl.origin}/api/sumup/refund`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            transaction_id: receiptData.transaction_id,
            amount: amount < receiptData.total ? amount : undefined, // Partial or full refund
          }),
        });

        if (!sumupRefundRes.ok) {
          const errorData = await sumupRefundRes.json();
          console.error('[Refund] SumUp refund failed:', errorData);
          return NextResponse.json(
            { error: `SumUp refund failed: ${errorData.error || 'Unknown error'}` },
            { status: sumupRefundRes.status }
          );
        }

        console.log('[Refund] SumUp refund successful');
      } catch (error) {
        console.error('[Refund] Error calling SumUp refund API:', error);
        return NextResponse.json(
          { error: 'Failed to process card refund. Please try again.' },
          { status: 500 }
        );
      }
    }

    // Insert refund record
    const { data: refund, error: refundError } = await supabase
      .from("refunds")
      .insert({
        org_id: orgId,
        receipt_id: receiptId,
        refund_number: refundNumber,
        member_id: memberId,
        amount: amount,
        reason: reason,
        lines: refundLines,
        payment_method: primaryPayment.method,
        payment_reference: primaryPayment.reference,
        status: "completed",
      })
      .select()
      .single();

    if (refundError) {
      console.error("Error creating refund:", refundError);
      return NextResponse.json(
        { error: "Failed to create refund" },
        { status: 500 }
      );
    }

    // Update receipt status and refunded amount
    const newRefundedAmount = (receipt as any).refunded_amount + amount;
    const newStatus =
      newRefundedAmount >= (receipt as any).total
        ? "fully_refunded"
        : "partially_refunded";

    const { error: updateError } = await supabase
      .from("receipts")
      .update({
        refunded_amount: newRefundedAmount,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", receiptId);

    if (updateError) {
      console.error("Error updating receipt:", updateError);
      return NextResponse.json(
        { error: "Failed to update receipt" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      refund: refund,
      message: "Refund processed successfully",
    });
  } catch (error) {
    console.error("Error in refund API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
