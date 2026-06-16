export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';

// POST /api/vouchers/redeem
// Body: { code: string, line_total?: number }
// Returns voucher details for applying to cart, or marks as redeemed
export async function POST(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await request.json();
  const { code, id, confirm = false } = body;

  if (!code && !id) {
    return NextResponse.json({ error: 'Voucher code or id is required' }, { status: 400 });
  }

  let query = supabase
    .from('gift_vouchers')
    .select('*')
    .eq('org_id', session.org_id);

  if (id) {
    query = query.eq('id', id);
  } else {
    query = query.ilike('code', code.trim());
  }

  const { data: voucher, error } = await query.single();

  if (error || !voucher) {
    return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });
  }

  const v = voucher as any;

  if (v.status !== 'active') {
    return NextResponse.json({
      error: v.status === 'redeemed' ? 'This voucher has already been redeemed'
           : v.status === 'expired' ? 'This voucher has expired'
           : 'This voucher is no longer valid',
    }, { status: 400 });
  }

  if (v.expires_at && new Date(v.expires_at) < new Date()) {
    // Auto-expire it
    await supabase.from('gift_vouchers').update({ status: 'expired' }).eq('id', v.id);
    return NextResponse.json({ error: 'This voucher has expired' }, { status: 400 });
  }

  // If confirm=true, mark as redeemed
  if (confirm) {
    await supabase
      .from('gift_vouchers')
      .update({ status: 'redeemed', redeemed_at: new Date().toISOString() })
      .eq('id', v.id);
  }

  // Return discount info for the cart
  const discountType =
    v.voucher_type === 'amount' ? 'fixed'
    : v.voucher_type === 'percent' ? 'percentage'
    : 'free_item';

  const discountValue =
    v.voucher_type === 'amount' ? Number(v.amount)
    : v.voucher_type === 'percent' ? Number(v.percent_discount)
    : 0;

  const name =
    v.voucher_type === 'amount' ? `Gift Voucher £${Number(v.amount).toFixed(2)}`
    : v.voucher_type === 'percent' ? `Gift Voucher ${v.percent_discount}% Off`
    : `Free Item: ${v.item_name}`;

  return NextResponse.json({
    voucher: {
      id: v.id,
      code: v.code,
      name,
      discountType,
      discountValue,
      recipient_name: v.recipient_name,
      voucher_type: v.voucher_type,
      item_name: v.item_name,
    },
  });
}
