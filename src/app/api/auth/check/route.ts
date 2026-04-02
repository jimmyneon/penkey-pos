import { NextRequest, NextResponse } from "next/server";
import { validatePOSSession } from "@/lib/api/auth";

/**
 * Check if user has a valid session
 * Used by client to determine if user is already authenticated
 */
export async function GET(request: NextRequest) {
  try {
    // ✅ SECURITY: Validate session from httpOnly cookie
    const session = await validatePOSSession(request);
    
    if (!session) {
      return NextResponse.json(
        { error: "No valid session" },
        { status: 401 }
      );
    }

    // Return session info (without sensitive data)
    return NextResponse.json({
      authenticated: true,
      user_id: session.user_id,
      org_id: session.org_id,
    });
  } catch (error: any) {
    console.error("[Auth Check] Error:", error);
    return NextResponse.json(
      { error: "Session check failed" },
      { status: 500 }
    );
  }
}
