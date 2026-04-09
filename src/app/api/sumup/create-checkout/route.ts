export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

// SumUp Cloud API: POST /v0.1/merchants/{code}/readers/{id}/checkout
// Docs: https://developer.sumup.com/terminal-payments/cloud-api
export async function POST(request: NextRequest) {
  try {
    // Credentials are passed from the browser via headers (stored in localStorage)
    const apiKey = request.headers.get('x-sumup-api-key') || process.env.SUMUP_API_KEY;
    const merchantCode = request.headers.get('x-sumup-merchant-code') || process.env.SUMUP_MERCHANT_CODE;
    const affiliateKey = request.headers.get('x-sumup-affiliate-key') || process.env.SUMUP_AFFILIATE_KEY || '';
    const apiBase = process.env.SUMUP_API_BASE || 'https://api.sumup.com';

    if (!apiKey || !merchantCode) {
      return NextResponse.json(
        { error: 'SumUp API credentials not configured. Please connect SumUp in Settings.' },
        { status: 400 }
      );
    }

    const { amount, currency = 'GBP', reader_id, description } = await request.json();

    if (!amount || !reader_id) {
      return NextResponse.json(
        { error: 'amount and reader_id are required' },
        { status: 400 }
      );
    }

    // Convert amount to minor units (pence/cents)
    const minorUnitAmount = Math.round(amount * 100);

    const body: Record<string, any> = {
      total_amount: {
        currency,
        minor_unit: 2,
        value: minorUnitAmount,
      },
    };

    if (description) body.description = description;
    if (affiliateKey) body.affiliate = { app_id: affiliateKey };

    // Correct SumUp Cloud API endpoint for reader-initiated checkout
    const sumupResponse = await fetch(
      `${apiBase}/v0.1/merchants/${merchantCode}/readers/${reader_id}/checkout`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!sumupResponse.ok) {
      let errorData: any = {};
      try { errorData = await sumupResponse.json(); } catch {}
      console.error('[SumUp] Checkout error:', sumupResponse.status, errorData);

      const message =
        sumupResponse.status === 409
          ? 'Terminal is busy – another checkout is in progress'
          : sumupResponse.status === 404
          ? 'Terminal not found – please re-pair the reader'
          : errorData?.message || 'Failed to start checkout on terminal';

      return NextResponse.json({ error: message }, { status: sumupResponse.status });
    }

    const checkoutData = await sumupResponse.json();

    return NextResponse.json({
      success: true,
      checkout_id: checkoutData.id,
      checkout: checkoutData,
    });

  } catch (error) {
    console.error('[SumUp] Create checkout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
