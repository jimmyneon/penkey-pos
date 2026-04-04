import { NextRequest, NextResponse } from 'next/server';

const SUMUP_API_BASE = process.env.SUMUP_API_BASE || 'https://api.sumup.com';
const SUMUP_API_KEY = process.env.SUMUP_API_KEY;
const SUMUP_MERCHANT_CODE = process.env.SUMUP_MERCHANT_CODE;

export async function GET(request: NextRequest) {
  try {
    if (!SUMUP_API_KEY || !SUMUP_MERCHANT_CODE) {
      return NextResponse.json(
        { error: 'SumUp API credentials not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const checkoutId = searchParams.get('checkoutId');

    if (!checkoutId) {
      return NextResponse.json(
        { error: 'Checkout ID is required' },
        { status: 400 }
      );
    }

    // Call SumUp API to get checkout status
    const sumupResponse = await fetch(
      `${SUMUP_API_BASE}/v0.1/merchants/${SUMUP_MERCHANT_CODE}/checkouts/${checkoutId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SUMUP_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!sumupResponse.ok) {
      const errorData = await sumupResponse.json();
      console.error('SumUp checkout status error:', errorData);
      
      if (sumupResponse.status === 404) {
        return NextResponse.json(
          { error: 'Checkout not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to get checkout status from SumUp' },
        { status: sumupResponse.status }
      );
    }

    const checkoutData = await sumupResponse.json();

    return NextResponse.json({
      success: true,
      checkout: checkoutData,
      status: checkoutData.status,
    });

  } catch (error) {
    console.error('Checkout status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
