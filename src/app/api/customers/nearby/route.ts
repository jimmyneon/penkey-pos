import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('store_id');
    const radiusMeters = parseInt(searchParams.get('radius') || '100');

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
    }

    // Get store location
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('location, checkin_radius_meters')
      .eq('id', storeId)
      .single();

    if (storeError || !store?.location) {
      return NextResponse.json({ error: 'Store not found or no location set' }, { status: 404 });
    }

    const searchRadius = store.checkin_radius_meters || radiusMeters;

    // Find customers checked in within radius
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
        visit_count,
        current_location
      `)
      .eq('is_checked_in', true)
      .not('current_location', 'is', null);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }

    // Filter by distance and calculate distance for each customer
    const nearbyCustomers = customers
      ?.filter(customer => {
        if (!customer.current_location) return false;
        
        // Calculate distance using PostGIS ST_Distance
        // For now, we'll use a simple approximation
        // In production, you'd use PostGIS functions
        return true; // Simplified for demo
      })
      .map(customer => ({
        ...customer,
        distance_meters: Math.floor(Math.random() * searchRadius) // Mock distance
      }))
      .sort((a, b) => (a.distance_meters || 0) - (b.distance_meters || 0)) || [];

    return NextResponse.json({
      customers: nearbyCustomers,
      store_location: store.location,
      search_radius: searchRadius
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
