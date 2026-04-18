export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const { email, password, first_name, last_name, role_name = 'Cashier' } = await request.json();

    if (!email || !password || !first_name || !last_name) {
      return NextResponse.json(
        { error: "Email, password, first_name, and last_name are required" },
        { status: 400 }
      );
    }

    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name,
        name: `${first_name} ${last_name}`,
      },
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "Failed to create user in auth", details: authError?.message },
        { status: 500 }
      );
    }

    // 2. Get org_id (Penkey org)
    const { data: orgData } = await supabaseAdmin
      .from('orgs')
      .select('id')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single();

    if (!orgData) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // 3. Get role_id based on role_name
    const { data: roleData } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', role_name)
      .eq('org_id', orgData.id)
      .single();

    if (!roleData) {
      return NextResponse.json(
        { error: `Role '${role_name}' not found` },
        { status: 404 }
      );
    }

    // 4. Create org_members entry
    const { data: memberData, error: memberError } = await supabaseAdmin
      .from('org_members')
      .insert({
        org_id: orgData.id,
        user_id: authData.user.id,
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
      // Rollback: delete the auth user if org_members creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: "Failed to create org_members entry", details: memberError?.message },
        { status: 500 }
      );
    }

    // 5. Create employee_pins entry with default PIN "0000"
    const { error: pinError } = await supabaseAdmin
      .from('employee_pins')
      .insert({
        member_id: memberData.id,
        pin_hash: await supabaseAdmin.rpc('hash_pin', { p_pin: '0000' }),
      });

    if (pinError) {
      // Rollback: delete the auth user and org_members entry if PIN creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabaseAdmin.from('org_members').delete().eq('id', memberData.id);
      return NextResponse.json(
        { error: "Failed to create employee_pins entry", details: pinError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        first_name,
        last_name,
        role: role_name,
        default_pin: '0000',
      },
    });
  } catch (error: any) {
    console.error("Create user error:", error);
    return NextResponse.json(
      { error: "Failed to create user", details: error.message },
      { status: 500 }
    );
  }
}
