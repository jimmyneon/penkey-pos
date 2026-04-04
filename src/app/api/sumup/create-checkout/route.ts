import { NextRequest, NextResponse } from 'next/server';

const SUMUP_API_BASE = process.env.SUMUP_API_BASE || 'https://api.sumup.com';
const SUMUP_API_KEY = process.env.SUMUP_API_KEY;
const SUMUP_MERCHANT_CODE = process.env.SUMUP_MERCHANT_CODE;

export async function POST(request: NextRequest) {
  try {
    if (!SUMUP_API_KEY || !SUMUP_MERCHANT_CODE) {
      return NextResponse.json(
        { error: 'SumUp API credentials not configured' },
        { status: 500 }
      );
    }

    const { amount, currency, reader_id, description, pay_to_email } = await request.json();

    if (!amount || !currency || !reader_id || !description) {
      return NextResponse.json(
        { error: 'Amount, currency, reader_id, and description are required' },
        { status: 400 }
      );
    }

    // Call SumUp API to create checkout
    const sumupResponse = await fetch(
      `${SUMUP_API_BASE}/v0.1/merchants/${SUMUP_MERCHANT_CODE}/checkouts`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUMUP_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Convert to cents/pence
          currency,
          description,
          reader_id,
          pay_to_email: pay_to_email || 'merchant@example.com',
        }),
      }
    );

    if (!sumupResponse.ok) {
      const errorData = await sumupResponse.json();
      console.error('SumUp checkout error:', errorData);
      
      if (sumupResponse.status === 400) {
        return NextResponse.json(
          { error: 'Invalid checkout parameters or terminal not available' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to create checkout with SumUp' },
        { status: sumupResponse.status }
      );
    }

    const checkoutData = await sumupResponse.json();
    const checkoutId = checkoutData.id;

    if (!checkoutId) {
      return NextResponse.json(
        { error: 'Checkout ID not received from SumUp' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      checkout_id: checkoutId,
      checkout: checkoutData,
    });

  } catch (error) {
    console.error('Create checkout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
