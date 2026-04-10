export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';
import { getStoredSumUpCredentials } from '../credentials/route';

/**
 * GET /api/sumup/terminate-checkout?reader_id=xxx
 * Terminates a pending checkout on the reader.
 * SumUp API: POST /v0.1/merchants/{code}/readers/{reader_id}/terminate
 */
export async function GET(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const apiBase = process.env.SUMUP_API_BASE || 'https://api.sumup.com';
  const creds = await getStoredSumUpCredentials(session.org_id);
  const apiKey = creds?.api_key || process.env.SUMUP_API_KEY;
  const merchantCode = creds?.merchant_code || process.env.SUMUP_MERCHANT_CODE;

  if (!apiKey || !merchantCode) {
    return NextResponse.json({ error: 'SumUp not configured' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const readerId = searchParams.get('reader_id');

  if (!readerId) {
    return NextResponse.json({ error: 'reader_id is required' }, { status: 400 });
  }

  try {
    console.log('[SumUp] Terminating checkout on reader:', readerId);
    const res = await fetch(
      `${apiBase}/v0.1/merchants/${merchantCode}/readers/${readerId}/terminate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('[SumUp] Terminate response status:', res.status);

    if (!res.ok) {
      let errorData: any = {};
      try { errorData = await res.json(); } catch {}
      console.error('[SumUp] Terminate error:', errorData);
      return NextResponse.json({ 
        error: 'Failed to terminate checkout',
        details: errorData 
      }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SumUp] Terminate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
