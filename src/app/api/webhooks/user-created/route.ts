export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabase webhook endpoint for user creation
// Configure this in Supabase Dashboard: Database → Webhooks → Add Webhook
// Event type: auth.user.created
// Endpoint: https://your-domain.com/api/webhooks/user-created

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Verify this is from Supabase webhook
    const eventType = body.type;
    const user = body.record;
    
    if (eventType !== 'auth.user.created' || !user) {
      return NextResponse.json({ received: true });
    }

    const { id: user_id, email, raw_user_meta_data } = user;
    const first_name = raw_user_meta_data?.first_name || 'New';
    const last_name = raw_user_meta_data?.last_name || 'User';

    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Get org_id (Penkey org)
    const { data: orgData } = await supabaseAdmin
      .from('orgs')
      .select('id')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single();

    if (!orgData) {
      console.error('Organization not found');
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // 2. Get role_id (default to Cashier)
    const { data: roleData } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', 'Cashier')
      .eq('org_id', orgData.id)
      .single();

    if (!roleData) {
      console.error('Cashier role not found');
      return NextResponse.json({ error: 'Cashier role not found' }, { status: 404 });
    }

    // 3. Create org_members entry
    const { data: memberData, error: memberError } = await supabaseAdmin
      .from('org_members')
      .insert({
        org_id: orgData.id,
        user_id,
        email,
        first_name,
        last_name,
        display_name: `${first_name} ${last_name}`,
        role_id: roleData.id,
        is_active: true,
      })
      .select('id')
      .single();

    if (memberError || !memberData) {
      console.error('Failed to create org_members entry:', memberError);
      return NextResponse.json({ error: 'Failed to create org_members entry' }, { status: 500 });
    }

    // 4. Create employee_pins entry with default PIN "0000"
    const { error: pinError } = await supabaseAdmin
      .from('employee_pins')
      .insert({
        member_id: memberData.id,
        pin_hash: await supabaseAdmin.rpc('hash_pin', { p_pin: '0000' }),
      });

    if (pinError) {
      console.error('Failed to create employee_pins entry:', pinError);
      // Don't fail the webhook, just log the error
    }

    console.log(`Successfully created employee records for user: ${email}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
