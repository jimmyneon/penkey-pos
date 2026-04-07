export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    const { pairingCode, name } = await request.json();

    if (!pairingCode || !name) {
      return NextResponse.json(
        { error: 'Pairing code and name are required' },
        { status: 400 }
      );
    }

    // Call SumUp API to pair reader
    const sumupResponse = await fetch(
      `${SUMUP_API_BASE}/v0.1/merchants/${SUMUP_MERCHANT_CODE}/readers`,
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
      })
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
