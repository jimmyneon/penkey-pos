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
  const statusParam = searchParams.get('status');

  let query = supabase
    .from('orders')
    .select('*')
    .eq('org_id', session.org_id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (statusParam) {
    const statuses = statusParam.split(',');
    query = query.in('status', statuses);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[Orders GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: data });
}

export async function POST(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await request.json();
  const { customer_name, customer_email, customer_phone, lines, subtotal, tax_total, tip_amount, total, notes, dining_option, requested_for, source } = body;

  if (!lines || lines.length === 0) {
    return NextResponse.json({ error: 'No items in order' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('orders')
    .insert({
      org_id: session.org_id,
      source: source || 'online',
      customer_name: customer_name || null,
      customer_email: customer_email || null,
      customer_phone: customer_phone || null,
      lines,
      subtotal: subtotal || 0,
      tax_total: tax_total || 0,
      tip_amount: tip_amount || 0,
      total: total || 0,
      notes: notes || null,
      dining_option: dining_option || 'takeaway',
      requested_for: requested_for || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('[Orders POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ order: data }, { status: 201 });
}
