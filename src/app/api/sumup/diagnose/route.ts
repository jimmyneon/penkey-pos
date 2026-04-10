export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';
import { getStoredSumUpCredentials } from '../credentials/route';

/**
 * GET /api/sumup/diagnose?reader_id=xxx
 * 
 * Diagnostic endpoint that:
 * 1. Checks reader status (online/offline, state, battery)
 * 2. If reader is stuck in a checkout state, terminates it
 * 3. Returns full diagnostic info
 */
export async function GET(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const apiBase = process.env.SUMUP_API_BASE || 'https://api.sumup.com';
  const creds = await getStoredSumUpCredentials(session.org_id);
  const apiKey = creds?.api_key || process.env.SUMUP_API_KEY;
  const merchantCode = creds?.merchant_code || process.env.SUMUP_MERCHANT_CODE;
  const affiliateKey = creds?.affiliate_key || '';

  if (!apiKey || !merchantCode) {
    return NextResponse.json({ error: 'SumUp not configured' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const readerId = searchParams.get('reader_id');
  const autoFix = searchParams.get('fix') === 'true';

  if (!readerId) {
    return NextResponse.json({ error: 'reader_id is required' }, { status: 400 });
  }

  const diagnosis: any = {
    reader_id: readerId,
    merchant_code: merchantCode,
    affiliate_key_present: !!affiliateKey,
    affiliate_key_length: affiliateKey?.length || 0,
    timestamp: new Date().toISOString(),
  };

  try {
    // 1. Check reader info
    const readerRes = await fetch(
      `${apiBase}/v0.1/merchants/${merchantCode}/readers/${readerId}`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    );
    if (readerRes.ok) {
      diagnosis.reader_info = await readerRes.json();
    } else {
      diagnosis.reader_info_error = { status: readerRes.status };
      try { diagnosis.reader_info_error.body = await readerRes.json(); } catch {}
    }

    // 2. Check reader status
    const statusRes = await fetch(
      `${apiBase}/v0.1/merchants/${merchantCode}/readers/${readerId}/status`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    );
    if (statusRes.ok) {
      diagnosis.reader_status = await statusRes.json();
      diagnosis.reader_state = diagnosis.reader_status?.data?.state;
      diagnosis.reader_online = diagnosis.reader_status?.data?.status;
      diagnosis.battery_level = diagnosis.reader_status?.data?.battery_level;
    } else {
      diagnosis.reader_status_error = { status: statusRes.status };
      try { diagnosis.reader_status_error.body = await statusRes.json(); } catch {}
    }

    // 3. If reader is stuck (not IDLE), try to terminate
    const stuckStates = ['WAITING_FOR_CARD', 'WAITING_FOR_PIN', 'SELECTING_TIP', 'WAITING_FOR_SIGNATURE'];
    if (autoFix && stuckStates.includes(diagnosis.reader_state)) {
      console.log('[Diagnose] Reader is stuck in state:', diagnosis.reader_state, '- terminating');
      const terminateRes = await fetch(
        `${apiBase}/v0.1/merchants/${merchantCode}/readers/${readerId}/terminate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      diagnosis.terminate_result = {
        status: terminateRes.status,
        ok: terminateRes.ok,
      };
      if (!terminateRes.ok) {
        try { diagnosis.terminate_result.body = await terminateRes.json(); } catch {}
      }

      // Wait and re-check status
      await new Promise(resolve => setTimeout(resolve, 3000));
      const recheck = await fetch(
        `${apiBase}/v0.1/merchants/${merchantCode}/readers/${readerId}/status`,
        { headers: { 'Authorization': `Bearer ${apiKey}` } }
      );
      if (recheck.ok) {
        diagnosis.reader_status_after_fix = await recheck.json();
      }
    }

    // 4. Check recent transactions (Transactions API uses v2.1)
    const txRes = await fetch(
      `${apiBase}/v2.1/merchants/${merchantCode}/transactions?limit=3&order=descending`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    );
    if (txRes.ok) {
      diagnosis.recent_transactions = await txRes.json();
    } else {
      diagnosis.transactions_error = { status: txRes.status };
    }

    diagnosis.recommendations = [];
    if (!affiliateKey) {
      diagnosis.recommendations.push('CRITICAL: Affiliate Key is missing. This is REQUIRED for Cloud API. Go to SumUp Dashboard > Settings > For Developers > Toolkit > Affiliate Keys to create one.');
    }
    if (diagnosis.reader_online === 'OFFLINE') {
      diagnosis.recommendations.push('Reader is OFFLINE. Check Wi-Fi connection on the Solo device.');
    }
    if (stuckStates.includes(diagnosis.reader_state) && !autoFix) {
      diagnosis.recommendations.push(`Reader is stuck in ${diagnosis.reader_state}. Call this endpoint with ?fix=true to terminate the stuck checkout.`);
    }
    if (diagnosis.battery_level && diagnosis.battery_level < 20) {
      diagnosis.recommendations.push(`Battery is low (${diagnosis.battery_level}%). Please charge the reader.`);
    }

    return NextResponse.json(diagnosis);
  } catch (error) {
    console.error('[Diagnose] Error:', error);
    return NextResponse.json({ 
      error: 'Diagnostic failed', 
      details: error instanceof Error ? error.message : String(error),
      partial_diagnosis: diagnosis 
    }, { status: 500 });
  }
}
