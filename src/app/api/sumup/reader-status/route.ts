export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';
import { getStoredSumUpCredentials } from '../credentials/route';

// SumUp Reader Status API: GET /v0.1/merchants/{code}/readers/{reader_id}/status
// Docs: https://developer.sumup.com/api/readers/get-status
export async function GET(request: NextRequest) {
  try {
    const session = await validatePOSSession(request);
    if (!session) return unauthorizedResponse();

    const apiBase = process.env.SUMUP_API_BASE || 'https://api.sumup.com';

    // Get credentials from DB
    const dbCreds = await getStoredSumUpCredentials(session.org_id);
    const apiKey = dbCreds?.api_key || process.env.SUMUP_API_KEY;
    const merchantCode = dbCreds?.merchant_code || process.env.SUMUP_MERCHANT_CODE;

    if (!apiKey || !merchantCode) {
      return NextResponse.json(
        { error: 'SumUp API credentials not configured. Please connect SumUp in Settings.' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const readerId = searchParams.get('reader_id');

    if (!readerId) {
      return NextResponse.json(
        { error: 'reader_id is required' },
        { status: 400 }
      );
    }

    console.log('[SumUp Reader Status] Checking status for reader:', readerId);

    const sumupResponse = await fetch(
      `${apiBase}/v0.1/merchants/${merchantCode}/readers/${readerId}/status`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!sumupResponse.ok) {
      let errorData: any = {};
      try { errorData = await sumupResponse.json(); } catch {}
      console.error('[SumUp Reader Status] Error:', sumupResponse.status, errorData);

      const message =
        sumupResponse.status === 404
          ? 'Reader not found'
          : errorData?.message || 'Failed to get reader status';

      return NextResponse.json({ error: message }, { status: sumupResponse.status });
    }

    const statusData = await sumupResponse.json();
    console.log('[SumUp Reader Status] Status:', statusData);

    return NextResponse.json({
      success: true,
      ...statusData,
    });

  } catch (error) {
    console.error('[SumUp Reader Status] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
