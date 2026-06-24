export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';

export async function GET(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('active') === 'true';

  let query = (supabase
    .from('discounts') as any)
    .select('*')
    .eq('org_id', session.org_id)
    .order('created_at', { ascending: false });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query.limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ discounts: data || [] });
}

export async function POST(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await request.json();
  const {
    code,
    name,
    description,
    discount_type,
    discount_value,
    min_order_amount,
    max_discount_amount,
    usage_limit,
    one_per_customer,
    valid_from,
    valid_until,
    allowed_channels,
    is_active,
  } = body;

  if (!code || !name) {
    return NextResponse.json({ error: 'Code and name are required' }, { status: 400 });
  }

  if (!discount_type || !['percentage', 'fixed'].includes(discount_type)) {
    return NextResponse.json({ error: 'Invalid discount_type' }, { status: 400 });
  }

  if (discount_value == null || discount_value <= 0) {
    return NextResponse.json({ error: 'discount_value must be > 0' }, { status: 400 });
  }

  if (discount_type === 'percentage' && discount_value > 100) {
    return NextResponse.json({ error: 'Percentage cannot exceed 100' }, { status: 400 });
  }

  const insertData = {
      org_id: session.org_id,
      code: code.toUpperCase().trim(),
      name: name.trim(),
      description: description || null,
      discount_type,
      discount_value: parseFloat(discount_value),
      min_order_amount: min_order_amount ? parseFloat(min_order_amount) : 0,
      max_discount_amount: max_discount_amount ? parseFloat(max_discount_amount) : null,
      usage_limit: usage_limit || null,
      one_per_customer: one_per_customer || false,
      valid_from: valid_from || null,
      valid_until: valid_until || null,
      allowed_channels: allowed_channels || ['pos'],
      is_active: is_active !== false,
      created_by: session.user_id,
  };

  const { data, error } = await (supabase
    .from('discounts') as any)
    .insert(insertData)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A discount with this code already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ discount: data }, { status: 201 });
}
