export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';
import { DEFAULT_VOUCHER_LAYOUT, VoucherLayoutConfig } from '@/lib/voucher/voucher-layout-config';

// GET — load the org's voucher template layout
export async function GET(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: settings } = await supabase
    .from('org_settings')
    .select('settings')
    .eq('org_id', session.org_id)
    .maybeSingle();

  const layout = (settings as any)?.settings?.voucher_template_layout;

  if (!layout) {
    return NextResponse.json({ layout: DEFAULT_VOUCHER_LAYOUT });
  }

  // Merge with defaults to ensure new fields are present
  const merged = mergeLayout(DEFAULT_VOUCHER_LAYOUT, layout);
  return NextResponse.json({ layout: merged });
}

// POST — save the org's voucher template layout
export async function POST(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const body = await request.json();
  const { layout } = body as { layout: VoucherLayoutConfig };

  if (!layout || typeof layout !== 'object') {
    return NextResponse.json({ error: 'Missing layout object' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch existing settings to merge
  const { data: existing } = await supabase
    .from('org_settings')
    .select('settings')
    .eq('org_id', session.org_id)
    .maybeSingle();

  const currentSettings = (existing as any)?.settings || {};
  const updatedSettings = {
    ...currentSettings,
    voucher_template_layout: layout,
  };

  // Upsert into org_settings
  const { error } = await supabase
    .from('org_settings')
    .upsert(
      { org_id: session.org_id, settings: updatedSettings } as any,
      { onConflict: 'org_id' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// Deep merge: ensure all default keys exist, override with saved values
function mergeLayout(
  defaults: VoucherLayoutConfig,
  saved: Partial<VoucherLayoutConfig>
): VoucherLayoutConfig {
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof VoucherLayoutConfig)[]) {
    if (saved[key]) {
      result[key] = { ...defaults[key], ...saved[key] } as any;
    }
  }
  return result;
}
