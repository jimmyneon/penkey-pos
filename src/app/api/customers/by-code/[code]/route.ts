export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  try {
    const code = (await params).code;

    if (!code) {
      return NextResponse.json({ error: 'Customer code required' }, { status: 400 });
    }

    // Find customer by code
    const { data: customer, error } = await supabase
      .from('customers')
      .select(`
        id,
        customer_code,
        first_name,
        last_name,
        email,
        phone,
        points_balance,
        membership_tier,
        is_checked_in,
        last_checkin_at,
        total_spent,
        visit_count,
        org_id
      `)
      .eq('customer_code', code)
      .single();

    if (error || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json(customer);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
