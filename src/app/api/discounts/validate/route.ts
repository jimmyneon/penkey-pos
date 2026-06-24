export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';

export async function POST(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await request.json();
  const { code, order_amount, channel = 'pos' } = body;

  if (!code) {
    return NextResponse.json({ error: 'Discount code is required' }, { status: 400 });
  }

  const { data, error } = await (supabase
    .from('discounts') as any)
    .select('*')
    .eq('org_id', session.org_id)
    .eq('code', code.toUpperCase().trim())
    .eq('is_active', true)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const discount = data as any;

  if (!discount) {
    return NextResponse.json({ valid: false, error: 'Invalid discount code' }, { status: 200 });
  }

  // Check channel restriction
  const allowedChannels: string[] = discount.allowed_channels || ['pos'];
  if (!allowedChannels.includes(channel)) {
    return NextResponse.json({ valid: false, error: 'This discount code cannot be used here' }, { status: 200 });
  }

  // Check validity period
  const now = new Date();
  if (discount.valid_from && new Date(discount.valid_from) > now) {
    return NextResponse.json({ valid: false, error: 'This discount is not yet valid' }, { status: 200 });
  }
  if (discount.valid_until && new Date(discount.valid_until) < now) {
    return NextResponse.json({ valid: false, error: 'This discount has expired' }, { status: 200 });
  }

  // Check usage limit
  if (discount.usage_limit && discount.usage_count >= discount.usage_limit) {
    return NextResponse.json({ valid: false, error: 'This discount has reached its usage limit' }, { status: 200 });
  }

  // Check minimum order amount
  const orderTotal = parseFloat(order_amount) || 0;
  if (discount.min_order_amount && orderTotal < parseFloat(discount.min_order_amount)) {
    return NextResponse.json({
      valid: false,
      error: `Minimum order amount is £${parseFloat(discount.min_order_amount).toFixed(2)}`,
    }, { status: 200 });
  }

  // Calculate discount amount
  let discountAmount = 0;
  const dtype = discount.type;
  const dvalue = parseFloat(discount.value);
  if (dtype === 'percentage') {
    discountAmount = orderTotal * (dvalue / 100);
    if (discount.max_discount_amount) {
      discountAmount = Math.min(discountAmount, parseFloat(discount.max_discount_amount));
    }
  } else if (dtype === 'fixed' || dtype === 'fixed_amount') {
    discountAmount = Math.min(dvalue, orderTotal);
  }

  return NextResponse.json({
    valid: true,
    discount: {
      id: discount.id,
      code: discount.code,
      name: discount.name,
      discount_type: discount.type,
      discount_value: parseFloat(discount.value),
      discount_amount: discountAmount,
      min_order_amount: discount.min_order_amount ? parseFloat(discount.min_order_amount) : 0,
      max_discount_amount: discount.max_discount_amount ? parseFloat(discount.max_discount_amount) : null,
    },
  });
}
