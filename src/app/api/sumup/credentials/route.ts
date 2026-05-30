export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';

/**
 * Credentials are stored in org_settings.settings JSON under 'sumup_credentials' key.
 * This is org-scoped, so it works even with no registers created yet.
 */

const SETTINGS_KEY = 'sumup_credentials';

/** Helper: read settings from org_settings */
async function getOrgSettings(supabase: any, orgId: string): Promise<Record<string, any>> {
  const { data } = await supabase
    .from('org_settings')
    .select('settings')
    .eq('org_id', orgId)
    .maybeSingle();
  return (data?.settings as Record<string, any>) ?? {};
}

/**
 * GET /api/sumup/credentials
 * Returns whether SumUp is configured + non-sensitive info (merchant code only).
 */
export async function GET(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const settings = await getOrgSettings(supabase, session.org_id);
  const creds = settings[SETTINGS_KEY];

  if (!creds?.api_key || !creds?.merchant_code) {
    return NextResponse.json({ configured: false });
  }

  return NextResponse.json({
    configured: true,
    merchant_code: creds.merchant_code,
    affiliate_key: creds.affiliate_key || '',
    updated_at: creds.updated_at,
  });
}

/**
 * POST /api/sumup/credentials
 * Saves SumUp API credentials into register_settings.additional_settings.
 */
export async function POST(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const { api_key, merchant_code, affiliate_key } = await request.json();
  if (!api_key || !merchant_code) {
    return NextResponse.json({ error: 'api_key and merchant_code are required' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const existing = await getOrgSettings(supabase, session.org_id);
  const updated = {
    ...existing,
    [SETTINGS_KEY]: {
      api_key,
      merchant_code,
      affiliate_key: affiliate_key || null,
      updated_at: new Date().toISOString(),
    },
  };

  const { error } = await supabase
    .from('org_settings')
    .upsert(
      { org_id: session.org_id, settings: updated } as any,
      { onConflict: 'org_id' }
    );

  if (error) {
    console.error('[SumUp Credentials] Save error:', error);
    return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 });
  }

  console.log(`[SumUp Credentials] Saved for org ${session.org_id}`);
  return NextResponse.json({ success: true, merchant_code });
}

/**
 * DELETE /api/sumup/credentials
 * Removes SumUp credentials from register_settings.
 */
export async function DELETE(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const existing = await getOrgSettings(supabase, session.org_id);
  const { [SETTINGS_KEY]: _removed, ...rest } = existing;
  await supabase
    .from('org_settings')
    .upsert({ org_id: session.org_id, settings: rest } as any, { onConflict: 'org_id' });

  return NextResponse.json({ success: true });
}

/**
 * Internal helper: fetch raw credentials for use by other API routes.
 * Returns null if not configured.
 */
export async function getStoredSumUpCredentials(orgId: string): Promise<{
  api_key: string;
  merchant_code: string;
  affiliate_key: string;
} | null> {
  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const settings = await getOrgSettings(supabase, orgId);
  const creds = settings[SETTINGS_KEY];
  if (!creds?.api_key || !creds?.merchant_code) return null;

  return {
    api_key: creds.api_key,
    merchant_code: creds.merchant_code,
    affiliate_key: creds.affiliate_key || '',
  };
}
