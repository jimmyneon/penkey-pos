import { NextRequest, NextResponse } from "next/server";

/**
 * Logout endpoint - clears httpOnly session cookie
 */
export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Clear httpOnly cookie
    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    // Clear the session cookie
    response.cookies.set('pos_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0, // Immediately expire
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error("[Logout] Error:", error);
    return NextResponse.json(
      { error: "Logout failed" },
      { status: 500 }
    );
  }
}
