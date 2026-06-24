export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await request.json();
  const updateFields: Record<string, any> = {};

  const allowedFields = [
    'code', 'name', 'description', 'discount_type', 'discount_value',
    'min_order_amount', 'max_discount_amount', 'usage_limit',
    'one_per_customer', 'valid_from', 'valid_until', 'allowed_channels', 'is_active',
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateFields[field] = body[field];
    }
  }

  if (updateFields.code) {
    updateFields.code = updateFields.code.toUpperCase().trim();
  }
  if (updateFields.discount_value !== undefined) {
    updateFields.discount_value = parseFloat(updateFields.discount_value);
  }
  if (updateFields.min_order_amount !== undefined) {
    updateFields.min_order_amount = parseFloat(updateFields.min_order_amount) || 0;
  }
  if (updateFields.max_discount_amount !== undefined) {
    updateFields.max_discount_amount = updateFields.max_discount_amount ? parseFloat(updateFields.max_discount_amount) : null;
  }

  const { data, error } = await (supabase
    .from('discounts') as any)
    .update(updateFields)
    .eq('id', params.id)
    .eq('org_id', session.org_id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A discount with this code already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Discount not found' }, { status: 404 });
  }

  return NextResponse.json({ discount: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await (supabase
    .from('discounts') as any)
    .delete()
    .eq('id', params.id)
    .eq('org_id', session.org_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
