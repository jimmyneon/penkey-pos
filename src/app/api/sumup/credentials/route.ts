export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';

/**
 * Credentials are stored in register_settings.additional_settings using a synthetic
 * org-scoped register_id (org_${orgId}). This works even if no active registers exist yet,
 * avoiding the chicken-and-egg problem of needing a register to save credentials.
 */

const SETTINGS_KEY = 'sumup_credentials';

/** Helper: get synthetic org-scoped register_id (works even with no active registers) */
function getOrgScopedRegisterId(orgId: string): string {
  return `org_${orgId}`;
}

/** Helper: read additional_settings for a register */
async function getAdditionalSettings(supabase: any, registerId: string): Promise<Record<string, any>> {
  const { data } = await supabase
    .from('register_settings')
    .select('additional_settings')
    .eq('register_id', registerId)
    .maybeSingle();
  return (data?.additional_settings as Record<string, any>) ?? {};
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

  const registerId = getOrgScopedRegisterId(session.org_id);

  const settings = await getAdditionalSettings(supabase, registerId);
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

  const registerId = getOrgScopedRegisterId(session.org_id);

  const existing = await getAdditionalSettings(supabase, registerId);
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
    .from('register_settings')
    .upsert(
      { register_id: registerId, additional_settings: updated } as any,
      { onConflict: 'register_id' }
    );

  if (error) {
    console.error('[SumUp Credentials] Save error:', error);
    return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 });
  }

  console.log(`[SumUp Credentials] Saved for org ${session.org_id}, register ${registerId}`);
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

  const registerId = getOrgScopedRegisterId(session.org_id);
  const existing = await getAdditionalSettings(supabase, registerId);
  const { [SETTINGS_KEY]: _removed, ...rest } = existing;
  await supabase
    .from('register_settings')
    .upsert({ register_id: registerId, additional_settings: rest } as any, { onConflict: 'register_id' });

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

  const registerId = getOrgScopedRegisterId(orgId);

  const settings = await getAdditionalSettings(supabase, registerId);
  const creds = settings[SETTINGS_KEY];
  if (!creds?.api_key || !creds?.merchant_code) return null;

  return {
    api_key: creds.api_key,
    merchant_code: creds.merchant_code,
    affiliate_key: creds.affiliate_key || '',
  };
}
