export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';
import { generateVoucherPng, VoucherTemplateData } from '@/lib/voucher/voucher-template';
import { DEFAULT_VOUCHER_LAYOUT, DEFAULT_VOUCHER_TEMPLATE, VoucherLayoutConfig, VoucherTemplate } from '@/lib/voucher/voucher-layout-config';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: voucher, error } = await supabase
    .from('gift_vouchers')
    .select('*')
    .eq('id', params.id)
    .eq('org_id', session.org_id)
    .single();

  if (error || !voucher) {
    return new NextResponse('Voucher not found', { status: 404 });
  }

  const v = voucher as any;

  let storeName = 'Penkey';
  let storeAddress: string | undefined;
  try {
    const { data: store } = await supabase
      .from('stores')
      .select('name, address')
      .eq('org_id', session.org_id)
      .limit(1)
      .maybeSingle();
    if ((store as any)?.name) {
      storeName = (store as any).name;
      storeAddress = (store as any).address || undefined;
    }
  } catch {}

  const templateData: VoucherTemplateData = {
    code: v.code,
    voucher_type: v.voucher_type,
    amount: v.amount,
    percent_discount: v.percent_discount,
    item_name: v.item_name,
    voucher_title: v.voucher_title,
    recipient_name: v.recipient_name,
    recipient_email: v.recipient_email,
    message: v.message,
    expires_at: v.expires_at,
    storeName,
    storeAddress,
  };

  // Load org's voucher templates and find the active one
  let layout: VoucherLayoutConfig = DEFAULT_VOUCHER_LAYOUT;
  let backgroundImageUrl: string | undefined;
  try {
    const { data: settings } = await supabase
      .from('org_settings')
      .select('settings')
      .eq('org_id', session.org_id)
      .maybeSingle();
    const s = (settings as any)?.settings || {};
    const templates: VoucherTemplate[] = s.voucher_templates || [];
    const activeId: string = s.active_voucher_template_id || 'default';

    // Try active template first, then fall back to default
    const activeTemplate = templates.find((t) => t.id === activeId)
      || templates.find((t) => t.id === 'default')
      || DEFAULT_VOUCHER_TEMPLATE;

    layout = activeTemplate.layout;
    backgroundImageUrl = activeTemplate.imageUrl;
  } catch {}

  try {
    const pngBuffer = await generateVoucherPng(templateData, layout, backgroundImageUrl);

    return new NextResponse(pngBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Disposition': `inline; filename="voucher-${v.code}.png"`,
      },
    });
  } catch (err) {
    console.error('[Voucher Image] Failed to generate PNG:', err);
    return new NextResponse('Failed to generate voucher image', { status: 500 });
  }
}
