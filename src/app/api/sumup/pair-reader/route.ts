export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';

export async function POST(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const apiBase = process.env.SUMUP_API_BASE || 'https://api.sumup.com';

  try {
    const { pairingCode, name, apiKey: bodyApiKey, merchantCode: bodyMerchantCode } = await request.json();

    // Use env vars (primary - single-tenant setup)
    const SUMUP_API_KEY = process.env.SUMUP_API_KEY || bodyApiKey;
    const SUMUP_MERCHANT_CODE = process.env.SUMUP_MERCHANT_CODE || bodyMerchantCode;

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
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
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
        { error: `Failed to save terminal to database: ${error.message || JSON.stringify(error)}` },
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
