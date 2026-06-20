export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';
import { sendVoucherEmail } from '../../route';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await request.json();
  const emailOverride = body?.email;

  const { data: voucher, error } = await supabase
    .from('gift_vouchers')
    .select('*')
    .eq('id', params.id)
    .eq('org_id', session.org_id)
    .single();

  if (error || !voucher) return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });

  const targetEmail = emailOverride || (voucher as any).recipient_email;
  if (!targetEmail) return NextResponse.json({ error: 'No email address' }, { status: 400 });

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

  try {
    await sendVoucherEmail({ ...(voucher as any), recipient_email: targetEmail, storeName, storeAddress });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Voucher email]', err);
    return NextResponse.json({ error: err.message || 'Failed to send email' }, { status: 500 });
  }
}
