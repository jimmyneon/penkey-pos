export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';
import { getStoredSumUpCredentials } from '@/app/api/sumup/credentials/route';

// SumUp Cloud API: POST /v0.1/merchants/{code}/readers/{id}/checkout
// Docs: https://developer.sumup.com/terminal-payments/cloud-api
export async function POST(request: NextRequest) {
  try {
    const session = await validatePOSSession(request);
    if (!session) return unauthorizedResponse();

    const apiBase = process.env.SUMUP_API_BASE || 'https://api.sumup.com';

    // 1. Try DB-stored credentials (persisted across devices)
    const dbCreds = await getStoredSumUpCredentials(session.org_id);
    console.log('[SumUp Checkout] DB creds:', dbCreds);
    // 2. Fall back to request headers (client localStorage) then env vars
    // TEMPORARY: Force env vars as fallback until DB retrieval is debugged
    const apiKey = dbCreds?.api_key || request.headers.get('x-sumup-api-key') || process.env.SUMUP_API_KEY;
    const merchantCode = dbCreds?.merchant_code || request.headers.get('x-sumup-merchant-code') || process.env.SUMUP_MERCHANT_CODE;
    const affiliateKey = dbCreds?.affiliate_key || request.headers.get('x-sumup-affiliate-key') || process.env.SUMUP_AFFILIATE_KEY || '';
    console.log('[SumUp Checkout] Using API key from:', dbCreds?.api_key ? 'DB' : request.headers.get('x-sumup-api-key') ? 'Header' : 'Env var');
    console.log('[SumUp Checkout] API key (first 10 chars):', apiKey?.substring(0, 10));
    console.log('[SumUp Checkout] Merchant code:', merchantCode);
    console.log('[SumUp Checkout] Affiliate key:', affiliateKey);
    console.log('[SumUp Checkout] Env vars available:', {
      hasApiKey: !!process.env.SUMUP_API_KEY,
      hasMerchantCode: !!process.env.SUMUP_MERCHANT_CODE,
      hasAffiliateKey: !!process.env.SUMUP_AFFILIATE_KEY,
    });

    if (!apiKey || !merchantCode) {
      return NextResponse.json(
        { error: 'SumUp API credentials not configured. Please connect SumUp in Settings.' },
        { status: 400 }
      );
    }

    if (!affiliateKey) {
      console.error('[SumUp Checkout] Affiliate key is missing - this is REQUIRED for Cloud API');
      return NextResponse.json(
        { error: 'SumUp Affiliate Key is required for Cloud API. Please add it in Settings > Payment Terminals.' },
        { status: 400 }
      );
    }

    const { amount, currency = 'GBP', reader_id, description, return_url } = await request.json();

    if (!amount || !reader_id) {
      return NextResponse.json(
        { error: 'amount and reader_id are required' },
        { status: 400 }
      );
    }

    // Convert amount to minor units (pence/cents)
    const minorUnitAmount = Math.round(amount * 100);
    const foreignTxId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    const body: Record<string, any> = {
      total_amount: {
        currency,
        minor_unit: 2,
        value: minorUnitAmount,
      },
      affiliate: {
        key: affiliateKey,
        app_id: 'com.penkey.pos',
        foreign_transaction_id: foreignTxId,
      },
    };

    if (description) body.description = description;
    if (return_url) body.return_url = return_url;

    console.log('[SumUp Checkout] Creating checkout for reader:', reader_id);
    console.log('[SumUp Checkout] Amount:', amount, currency, '→ minor units:', minorUnitAmount);
    console.log('[SumUp Checkout] Affiliate key present:', !!affiliateKey);
    console.log('[SumUp Checkout] Request body:', JSON.stringify(body, null, 2));

    // Correct SumUp Cloud API endpoint for reader-initiated checkout
    const sumupResponse = await fetch(
      `${apiBase}/v0.1/merchants/${merchantCode}/readers/${reader_id}/checkout`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!sumupResponse.ok) {
      let errorData: any = {};
      try { errorData = await sumupResponse.json(); } catch {}
      console.error('[SumUp] Checkout error:', sumupResponse.status, errorData);

      // Handle READER_BUSY error by terminating the pending checkout
      if (sumupResponse.status === 422 && errorData?.errors?.type === 'READER_BUSY') {
        console.log('[SumUp] Reader busy - attempting to terminate pending checkout');
        try {
          const terminateRes = await fetch(
            `${apiBase}/v0.1/merchants/${merchantCode}/readers/${reader_id}/terminate`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
            }
          );
          console.log('[SumUp] Terminate response:', terminateRes.status);
          
          if (terminateRes.ok) {
            return NextResponse.json({ 
              error: 'Previous checkout terminated. Please try again.',
              retry: true 
            }, { status: 409 });
          }
        } catch (terminateErr) {
          console.error('[SumUp] Failed to terminate checkout:', terminateErr);
        }
      }

      const message =
        sumupResponse.status === 409
          ? 'Terminal is busy – another checkout is in progress'
          : sumupResponse.status === 404
          ? 'Terminal not found – please re-pair the reader'
          : sumupResponse.status === 422 && errorData?.errors?.type === 'READER_BUSY'
          ? 'Reader is busy with a previous checkout. Please wait or restart the reader.'
          : errorData?.message || errorData?.error_message || errorData?.errors?.detail || JSON.stringify(errorData) || 'Failed to start checkout on terminal';

      return NextResponse.json({ error: message }, { status: sumupResponse.status });
    }

    const checkoutData = await sumupResponse.json();
    console.log('[SumUp Checkout] Response:', JSON.stringify(checkoutData, null, 2));

    // SumUp Cloud API returns: { data: { client_transaction_id: "..." } }
    const checkoutId = checkoutData.data?.client_transaction_id || checkoutData.client_transaction_id || checkoutData.id;
    
    if (!checkoutId) {
      console.error('[SumUp Checkout] No checkout ID in response:', checkoutData);
      return NextResponse.json({ 
        error: 'Failed to get checkout ID from SumUp',
        response: checkoutData 
      }, { status: 500 });
    }

    console.log('[SumUp Checkout] Created successfully - ID:', checkoutId);

    return NextResponse.json({
      success: true,
      checkout_id: checkoutId,
      client_transaction_id: checkoutId,
      checkout: checkoutData,
    });

  } catch (error) {
    console.error('[SumUp] Create checkout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
