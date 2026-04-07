export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const storeId = searchParams.get('store_id');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!query || query.length < 2) {
      return NextResponse.json({ customers: [] });
    }

    // Get org_id from store
    const { data: store } = await supabase
      .from('stores')
      .select('org_id')
      .eq('id', storeId)
      .single();

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Search customers by name, email, phone, or customer code
    const { data: customers, error } = await supabase
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
        visit_count
      `)
      .eq('org_id', store.org_id)
      .or(`
        first_name.ilike.%${query}%,
        last_name.ilike.%${query}%,
        email.ilike.%${query}%,
        phone.ilike.%${query}%,
        customer_code.ilike.%${query}%
      `)
      .order('last_checkin_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to search customers' }, { status: 500 });
    }

    return NextResponse.json({
      customers: customers || [],
      query,
      total: customers?.length || 0
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
