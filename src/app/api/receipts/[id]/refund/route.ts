export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession } from "@/lib/api/auth";

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

    // Get receipt details
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select("id, receipt_number, total, refunded_amount, status")
      .eq("id", receiptId)
      .single();

    if (receiptError || !receipt) {
      console.error('[Refund] Receipt fetch error:', receiptError);
      return NextResponse.json(
        { error: "Receipt not found" },
        { status: 404 }
      );
    }

    // Get payments (includes method, reference, and metadata for payment_provider/transaction_id)
    const { data: payments } = await supabase
      .from("payments")
      .select("method, amount, reference, metadata")
      .eq("receipt_id", receiptId);

    // Get receipt lines
    const { data: lines } = await supabase
      .from("receipt_lines")
      .select("id, name, quantity, line_total")
      .eq("receipt_id", receiptId);

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
    const primaryPayment = payments && payments[0] ? (payments[0] as any) : { method: "cash", reference: null, metadata: null };

    console.log('[Refund] Primary payment:', primaryPayment);
    console.log('[Refund] Payment metadata:', primaryPayment.metadata);

    // If payment was via SumUp card, process refund through SumUp API first
    const paymentMetadata = primaryPayment.metadata || {};
    let sumupVerified = false;
    let sumupTransactionData = null;

    if (primaryPayment.method === 'card' && paymentMetadata.payment_provider === 'sumup' && paymentMetadata.transaction_id) {
      try {
        console.log('[Refund] Processing SumUp refund for transaction:', paymentMetadata.transaction_id);

        const sumupRefundRes = await fetch(`${request.nextUrl.origin}/api/sumup/refund`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            transaction_id: paymentMetadata.transaction_id,
            amount: amount < (receipt as any).total ? amount : undefined, // Partial or full refund
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

        const sumupRefundData = await sumupRefundRes.json();
        console.log('[Refund] SumUp refund successful:', sumupRefundData);

        // Verify refund by querying SumUp Transactions API
        try {
          const sessionData = await validatePOSSession(request);
          if (sessionData) {
            const dbCreds = await (await import('@/app/api/sumup/credentials/route')).getStoredSumUpCredentials(sessionData.org_id);
            const apiKey = dbCreds?.api_key || process.env.SUMUP_API_KEY;
            const merchantCode = dbCreds?.merchant_code || process.env.SUMUP_MERCHANT_CODE;

            if (apiKey && merchantCode) {
              const txRes = await fetch(`${process.env.SUMUP_API_BASE || 'https://api.sumup.com'}/v2.1/merchants/${merchantCode}/transactions?client_transaction_id=${paymentMetadata.transaction_id}`, {
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                },
              });

              if (txRes.ok) {
                const txData = await txRes.json();
                console.log('[Refund] SumUp transaction verification:', txData);
                if (txData.items && txData.items.length > 0) {
                  const tx = txData.items[0];
                  sumupVerified = true;
                  sumupTransactionData = {
                    status: tx.status,
                    refund_status: tx.refund_status || null,
                    refunded_amount: tx.refunded_amount || null,
                  };
                }
              }
            }
          }
        } catch (verifyError) {
          console.error('[Refund] Failed to verify SumUp transaction:', verifyError);
          // Continue without verification - refund was still processed
        }
      } catch (error) {
        console.error('[Refund] Error calling SumUp refund API:', error);
        return NextResponse.json(
          { error: 'Failed to process card refund. Please try again.' },
          { status: 500 }
        );
      }
    }

    // Insert refund record
    const refundData: any = {
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
    };

    // Store SumUp refund confirmation if applicable
    if (primaryPayment.method === 'card' && paymentMetadata.payment_provider === 'sumup') {
      refundData.metadata = {
        payment_provider: 'sumup',
        transaction_id: paymentMetadata.transaction_id,
        checkout_id: paymentMetadata.checkout_id,
        sumup_refund_confirmed: true,
        sumup_refund_message: 'Refund processed via SumUp',
        sumup_verified: sumupVerified,
        sumup_transaction_data: sumupTransactionData,
      };
    }

    const { data: refund, error: refundError } = await supabase
      .from("refunds")
      .insert(refundData)
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
      message: primaryPayment.method === 'card' && paymentMetadata.payment_provider === 'sumup'
        ? (sumupVerified ? "Refund processed and verified via SumUp" : "Refund processed via SumUp")
        : "Refund processed successfully",
      sumup_confirmed: primaryPayment.method === 'card' && paymentMetadata.payment_provider === 'sumup',
      sumup_verified: sumupVerified,
      sumup_transaction_data: sumupTransactionData,
    });
  } catch (error) {
    console.error("Error in refund API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
