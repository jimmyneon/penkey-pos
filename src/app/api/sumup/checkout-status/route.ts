export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';
import { getStoredSumUpCredentials } from '@/app/api/sumup/credentials/route';

export async function GET(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const apiBase = process.env.SUMUP_API_BASE || 'https://api.sumup.com';
  const dbCreds = await getStoredSumUpCredentials(session.org_id);
  const apiKey = dbCreds?.api_key || request.headers.get('x-sumup-api-key') || process.env.SUMUP_API_KEY;
  const merchantCode = dbCreds?.merchant_code || request.headers.get('x-sumup-merchant-code') || process.env.SUMUP_MERCHANT_CODE;

  try {
    if (!apiKey || !merchantCode) {
      return NextResponse.json(
        { error: 'SumUp API credentials not configured. Please connect SumUp in Settings.' },
        { status: 400 }
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
    // GET /v0.1/merchants/{code}/readers/{reader_id}/checkout/{checkout_id}
    const readerId = searchParams.get('reader_id');
    const endpoint = readerId
      ? `${apiBase}/v0.1/merchants/${merchantCode}/readers/${readerId}/checkout/${checkoutId}`
      : `${apiBase}/v0.1/merchants/${merchantCode}/readers/checkout/${checkoutId}`;

    const sumupResponse = await fetch(
      endpoint,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
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
    console.log('[SumUp Checkout Status] Status:', checkoutData.status);
    console.log('[SumUp Checkout Status] Full response:', JSON.stringify(checkoutData, null, 2));

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
