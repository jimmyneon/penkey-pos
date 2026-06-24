export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { generateCSRFToken } from "@/lib/utils/csrf";
import { isAuthRateLimited, recordAuthFailure, recordAuthSuccess, getAuthRateLimitRemaining } from "@/lib/api/auth-ratelimit";

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Check rate limiting first
    if (isAuthRateLimited(request)) {
      const remaining = getAuthRateLimitRemaining(request);
      console.warn(`[AUTH-RATELIMIT] Login attempt blocked. Retry after ${remaining}s`);
      return NextResponse.json(
        { error: `Too many login attempts. Please try again in ${remaining} seconds.` },
        { status: 429 }
      );
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      // ✅ SECURITY: Record failed attempt
      recordAuthFailure(request);
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Get user's organization membership
    const { data: orgMembers, error: orgError } = await supabase
      .from("org_members")
      .select("id, org_id, first_name, last_name, display_name, role_id")
      .eq("user_id", authData.user.id) as any;

    if (orgError || !orgMembers || orgMembers.length === 0) {
      // User needs onboarding - return user info for onboarding component
      // Clear any existing session cookies to prevent using old session
      const response = NextResponse.json({
        needsOnboarding: true,
        user: {
          id: authData.user.id,
          email: authData.user.email,
        },
      });
      response.cookies.delete('pos_session');
      response.cookies.delete('csrf_token');
      return response;
    }

    const orgMember = orgMembers[0];

    // Get role information
    const { data: role } = await supabase
      .from("roles")
      .select("name, permissions")
      .eq("id", orgMember.role_id)
      .single() as any;

    // Create session object
    const sessionData = {
      user_id: authData.user.id,
      org_id: orgMember.org_id,
      org_member_id: orgMember.id,
      email: authData.user.email,
      name: orgMember.first_name,
      role: role?.name,
    };

    // ✅ SECURITY: Generate CSRF token
    const csrfToken = generateCSRFToken();

    // ✅ SECURITY: Set httpOnly cookie instead of returning token
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

    // ✅ SECURITY: Set CSRF token cookie (not httpOnly - needs to be readable by client)
    response.cookies.set('csrf_token', csrfToken, {
      httpOnly: false, // Must be readable by client to send in headers
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    // ✅ SECURITY: Record successful login (clears rate limit)
    recordAuthSuccess(request);

    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
