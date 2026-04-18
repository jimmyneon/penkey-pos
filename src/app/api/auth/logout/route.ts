export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";

/**
 * Logout endpoint - clears httpOnly session cookie and CSRF token
 */
export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Clear httpOnly cookie and CSRF token
    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    // Clear the session cookie
    response.cookies.delete('pos_session');
    response.cookies.delete('csrf_token');

    return response;
  } catch (error: any) {
    console.error("[Logout] Error:", error);
    return NextResponse.json(
      { error: "Logout failed" },
      { status: 500 }
    );
  }
}
