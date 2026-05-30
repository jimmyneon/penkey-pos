export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';

/**
 * SumUp Cloud API has NO "get checkout status" endpoint.
 * 
 * The correct approach per docs:
 * 1. Poll GET /v0.1/merchants/{code}/readers/{reader_id}/status
 *    → returns reader state: IDLE, WAITING_FOR_CARD, WAITING_FOR_PIN, etc.
 * 2. When reader returns to IDLE, check if payment succeeded via:
 *    GET /v0.1/merchants/{code}/transactions?client_transaction_id={id}
 *    → returns transaction with status: SUCCESSFUL, FAILED, CANCELLED, PENDING
 */
export async function GET(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const apiBase = process.env.SUMUP_API_BASE || 'https://api.sumup.com';
  // Use env vars (primary - single-tenant setup)
  const apiKey = process.env.SUMUP_API_KEY;
  const merchantCode = process.env.SUMUP_MERCHANT_CODE;

  try {
    if (!apiKey || !merchantCode) {
      return NextResponse.json(
        { error: 'SumUp API credentials not configured.' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const clientTransactionId = searchParams.get('checkoutId');
    const readerId = searchParams.get('reader_id');

    if (!readerId) {
      return NextResponse.json({ error: 'reader_id is required' }, { status: 400 });
    }

    // Step 1: Get reader status (state of the device)
    const readerStatusRes = await fetch(
      `${apiBase}/v0.1/merchants/${merchantCode}/readers/${readerId}/status`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      }
    );

    let readerState = 'UNKNOWN';
    let readerData: any = {};

    if (readerStatusRes.ok) {
      readerData = await readerStatusRes.json();
      readerState = readerData.data?.state || readerData.state || 'UNKNOWN';
      console.log('[Checkout Status] Reader state:', readerState);
    } else {
      console.warn('[Checkout Status] Could not get reader status:', readerStatusRes.status);
    }

    // If reader is actively processing, return reader state
    const activeStates = ['WAITING_FOR_CARD', 'WAITING_FOR_PIN', 'SELECTING_TIP', 'WAITING_FOR_SIGNATURE', 'PROCESSING'];
    if (activeStates.includes(readerState)) {
      return NextResponse.json({
        success: true,
        status: 'PENDING',
        reader_state: readerState,
        reader_data: readerData.data,
      });
    }

    // Step 2: Reader is IDLE - check if the transaction completed
    // IMPORTANT: Transactions API uses v2.1, NOT v0.1
    if (clientTransactionId) {
      const txUrl = `${apiBase}/v2.1/merchants/${merchantCode}/transactions?client_transaction_id=${clientTransactionId}`;
      console.log('[Checkout Status] Querying transaction API:', txUrl);
      const txRes = await fetch(
        txUrl,
        {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey}` },
        }
      );
      console.log('[Checkout Status] Transaction API response status:', txRes.status);

      if (txRes.ok) {
        const txData = await txRes.json();
        console.log('[Checkout Status] Transaction response:', JSON.stringify(txData, null, 2));

        // Transaction API returns a single transaction object
        const transaction = txData;
        const txStatus = transaction?.status;
        console.log('[Checkout Status] Transaction status:', txStatus, 'ID:', transaction?.id);

        if (txStatus === 'SUCCESSFUL') {
          return NextResponse.json({
            success: true,
            status: 'SUCCESSFUL',
            reader_state: readerState,
            transaction,
          });
        } else if (txStatus === 'FAILED' || txStatus === 'CANCELLED') {
          return NextResponse.json({
            success: true,
            status: txStatus,
            reader_state: readerState,
            transaction,
          });
        } else if (txStatus === 'PENDING') {
          return NextResponse.json({
            success: true,
            status: 'PENDING',
            reader_state: readerState,
            transaction,
          });
        }
      } else {
        const txHttpStatus = txRes.status;
        let errorBody: any = {};
        try { errorBody = await txRes.json(); } catch {}
        console.log('[Checkout Status] Transaction API returned', txHttpStatus, '- body:', JSON.stringify(errorBody));
        // 404 means transaction not recorded yet - this is expected briefly after IDLE
      }
    }

    // Reader is IDLE but no transaction found yet - could still be processing
    // or the transaction hasn't been recorded yet
    if (readerState === 'IDLE') {
      return NextResponse.json({
        success: true,
        status: 'IDLE',
        reader_state: readerState,
        reader_data: readerData.data,
      });
    }

    // Default: still pending
    return NextResponse.json({
      success: true,
      status: 'PENDING',
      reader_state: readerState,
      reader_data: readerData.data,
    });

  } catch (error) {
    console.error('[Checkout Status] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
