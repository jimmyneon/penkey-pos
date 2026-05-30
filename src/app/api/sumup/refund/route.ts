export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';

// SumUp Refund API: POST /v0.1/me/refund/{transaction_id}
// Docs: https://developer.sumup.com/online-payments/guides/refund
export async function POST(request: NextRequest) {
  try {
    const session = await validatePOSSession(request);
    if (!session) return unauthorizedResponse();

    const apiBase = process.env.SUMUP_API_BASE || 'https://api.sumup.com';

    // Use env vars (primary - single-tenant setup)
    const apiKey = process.env.SUMUP_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'SumUp API credentials not configured. Please connect SumUp in Settings.' },
        { status: 400 }
      );
    }

    const { transaction_id, amount } = await request.json();

    if (!transaction_id) {
      return NextResponse.json(
        { error: 'transaction_id is required' },
        { status: 400 }
      );
    }

    console.log('[SumUp Refund] Processing refund for transaction:', transaction_id, 'Amount:', amount || 'full');

    // Build request body - empty for full refund, amount for partial
    const body = amount ? { amount } : undefined;

    const sumupResponse = await fetch(
      `${apiBase}/v0.1/me/refund/${transaction_id}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      }
    );

    if (!sumupResponse.ok) {
      let errorData: any = {};
      try { errorData = await sumupResponse.json(); } catch {}
      console.error('[SumUp Refund] Error:', sumupResponse.status, errorData);

      const message =
        sumupResponse.status === 404
          ? 'Transaction not found'
          : sumupResponse.status === 400
          ? errorData?.message || 'Invalid refund request'
          : errorData?.message || 'Failed to process refund';

      return NextResponse.json({ error: message }, { status: sumupResponse.status });
    }

    // Successful refund returns 204 No Content
    console.log('[SumUp Refund] Refund successful for transaction:', transaction_id);

    return NextResponse.json({
      success: true,
      message: amount ? `Refunded ${amount}` : 'Full refund processed',
      transaction_id,
    });

  } catch (error) {
    console.error('[SumUp Refund] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
