export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';
import { getStoredSumUpCredentials } from '../credentials/route';

/**
 * GET /api/sumup/readers
 * Lists readers directly from SumUp API (not local DB)
 * Use this to see what readers are paired on your SumUp account
 */
export async function GET(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const creds = await getStoredSumUpCredentials(session.org_id);
  if (!creds) {
    return NextResponse.json(
      { error: 'SumUp not connected' },
      { status: 400 }
    );
  }

  const apiBase = process.env.SUMUP_API_BASE || 'https://api.sumup.com';

  try {
    const response = await fetch(
      `${apiBase}/v0.1/merchants/${creds.merchant_code}/readers`,
      {
        headers: {
          'Authorization': `Bearer ${creds.api_key}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('SumUp readers error:', errorData);
      return NextResponse.json(
        { error: 'Failed to fetch readers from SumUp' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      readers: data.items || [],
    });

  } catch (error) {
    console.error('Get readers error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sumup/readers
 * Unpair a reader directly from SumUp API by reader_id
 * Use this to unpair readers that are not in local DB
 */
export async function DELETE(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const readerId = searchParams.get('reader_id');

  if (!readerId) {
    return NextResponse.json(
      { error: 'reader_id is required' },
      { status: 400 }
    );
  }

  const creds = await getStoredSumUpCredentials(session.org_id);
  if (!creds) {
    return NextResponse.json(
      { error: 'SumUp not connected' },
      { status: 400 }
    );
  }

  const apiBase = process.env.SUMUP_API_BASE || 'https://api.sumup.com';

  try {
    const response = await fetch(
      `${apiBase}/v0.1/merchants/${creds.merchant_code}/readers/${readerId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${creds.api_key}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('SumUp unpair error:', errorData);
      return NextResponse.json(
        { error: 'Failed to unpair reader from SumUp' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Reader unpaired from SumUp',
    });

  } catch (error) {
    console.error('Unpair reader error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
