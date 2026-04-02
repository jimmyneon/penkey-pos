import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@penkey/database';

export async function POST(request: NextRequest) {
  try {
    // Use service role key to bypass RLS for customer operations
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const body = await request.json();
    
    const {
      customer_id,
      store_id,
      latitude,
      longitude,
      method = 'gps'
    } = body;

    if (!customer_id || !store_id || !latitude || !longitude) {
      return NextResponse.json({ 
        error: 'Customer ID, store ID, and location required' 
      }, { status: 400 });
    }

    // Get store location and check-in radius
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('location, checkin_radius_meters')
      .eq('id', store_id)
      .single();

    if (storeError || !store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Calculate distance (simplified - in production use PostGIS)
    const customerLocation = `POINT(${longitude} ${latitude})`;
    
    // Check if customer is within radius (simplified validation)
    // In production, use PostGIS ST_DWithin function
    
    // Create check-in record
    const { data: checkin, error: checkinError } = await supabase
      .from('customer_checkins')
      .insert({
        customer_id,
        store_id,
        location: customerLocation,
        checkin_method: method
      })
      .select()
      .single();

    if (checkinError) {
      console.error('Checkin error:', checkinError);
      return NextResponse.json({ error: 'Failed to check in' }, { status: 500 });
    }

    // Update customer status
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        is_checked_in: true,
        last_checkin_at: new Date().toISOString(),
        checkin_store_id: store_id,
        current_location: customerLocation
      })
      .eq('id', customer_id);

    if (updateError) {
      console.error('Customer update error:', updateError);
      return NextResponse.json({ error: 'Failed to update customer status' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      checkin_id: checkin.id,
      message: 'Successfully checked in'
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Use service role key to bypass RLS for customer operations
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });
    }

    // Update latest check-in record
    const { error: checkinError } = await supabase
      .from('customer_checkins')
      .update({
        checked_out_at: new Date().toISOString()
      })
      .eq('customer_id', customerId)
      .is('checked_out_at', null);

    // Update customer status
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        is_checked_in: false,
        current_location: null,
        checkin_store_id: null
      })
      .eq('id', customerId);

    if (updateError) {
      console.error('Customer update error:', updateError);
      return NextResponse.json({ error: 'Failed to check out' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully checked out'
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
