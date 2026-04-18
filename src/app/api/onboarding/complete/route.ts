export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { generateCSRFToken } from "@/lib/utils/csrf";

export async function POST(request: NextRequest) {
  try {
    const { userId, email, firstName, lastName, pin } = await request.json();

    if (!userId || !email || !firstName || !lastName || !pin) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get org_id (Penkey org)
    const { data: orgData } = await supabase
      .from('orgs')
      .select('id')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single() as any;

    if (!orgData) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Get role_id (default to Cashier)
    const { data: roleData } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'Cashier')
      .eq('org_id', orgData.id)
      .single() as any;

    if (!roleData) {
      return NextResponse.json(
        { error: "Cashier role not found" },
        { status: 404 }
      );
    }

    // Create org_members entry
    const { data: memberData, error: memberError } = await supabase
      .from('org_members')
      .insert({
        org_id: orgData.id,
        user_id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        display_name: `${firstName} ${lastName}`,
        role_id: roleData.id,
        is_active: true,
      } as any)
      .select('id')
      .single() as any;

    if (memberError || !memberData) {
      return NextResponse.json(
        { error: "Failed to create employee record", details: memberError?.message },
        { status: 500 }
      );
    }

    // Create employee_pins entry with the user's chosen PIN
    const { error: pinError } = await supabase
      .from('employee_pins')
      .insert({
        member_id: memberData.id,
        pin_hash: await supabase.rpc('hash_pin', { p_pin: pin } as any),
      } as any);

    if (pinError) {
      return NextResponse.json(
        { error: "Failed to create PIN entry", details: pinError?.message },
        { status: 500 }
      );
    }

    // Get role information
    const { data: role } = await supabase
      .from('roles')
      .select('name, permissions')
      .eq('id', roleData.id)
      .single() as any;

    // Create session object
    const sessionData = {
      user_id: userId,
      org_id: orgData.id,
      org_member_id: memberData.id,
      email,
      name: `${firstName} ${lastName}`,
      role: role?.name,
    };

    // Generate CSRF token
    const csrfToken = generateCSRFToken();

    // Create response with session data
    const response = NextResponse.json({
      success: true,
      user: sessionData,
    });

    // Set httpOnly, Secure, SameSite session cookie
    response.cookies.set('pos_session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    // Set CSRF token cookie
    response.cookies.set('csrf_token', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: "Onboarding failed", details: error.message },
      { status: 500 }
    );
  }
}
