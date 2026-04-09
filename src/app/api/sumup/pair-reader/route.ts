export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';
import { getStoredSumUpCredentials } from '../credentials/route';

export async function POST(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const apiBase = process.env.SUMUP_API_BASE || 'https://api.sumup.com';

  try {
    const { pairingCode, name, apiKey: bodyApiKey, merchantCode: bodyMerchantCode } = await request.json();

    // Read credentials from DB first, fall back to headers/env vars
    const dbCreds = await getStoredSumUpCredentials(session.org_id);
    const SUMUP_API_KEY = dbCreds?.api_key || request.headers.get('x-sumup-api-key') || bodyApiKey || process.env.SUMUP_API_KEY;
    const SUMUP_MERCHANT_CODE = dbCreds?.merchant_code || request.headers.get('x-sumup-merchant-code') || bodyMerchantCode || process.env.SUMUP_MERCHANT_CODE;

    if (!SUMUP_API_KEY || !SUMUP_MERCHANT_CODE) {
      return NextResponse.json(
        { error: 'SumUp API credentials not configured. Please connect SumUp in Settings first.' },
        { status: 400 }
      );
    }

    if (!pairingCode || !name) {
      return NextResponse.json(
        { error: 'Pairing code and name are required' },
        { status: 400 }
      );
    }

    // Call SumUp API to pair reader
    const sumupResponse = await fetch(
      `${apiBase}/v0.1/merchants/${SUMUP_MERCHANT_CODE}/readers`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUMUP_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pairing_code: pairingCode,
          name: name,
        }),
      }
    );

    if (!sumupResponse.ok) {
      const errorData = await sumupResponse.json();
      console.error('SumUp pairing error:', errorData);
      
      if (sumupResponse.status === 400) {
        return NextResponse.json(
          { error: 'Invalid or expired pairing code. Please generate a new one on your SumUp Solo device.' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to pair reader with SumUp' },
        { status: sumupResponse.status }
      );
    }

    const readerData = await sumupResponse.json();
    const readerId = readerData.id;

    if (!readerId) {
      return NextResponse.json(
        { error: 'Reader ID not received from SumUp' },
        { status: 500 }
      );
    }

    // Save to database
    const supabase = await createClient();
    const { data: terminal, error } = await supabase
      .from('terminals')
      .insert({
        name,
        reader_id: readerId,
        status: 'offline',
      } as any)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to save terminal to database' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      terminal,
    });

  } catch (error) {
    console.error('Pair reader error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
