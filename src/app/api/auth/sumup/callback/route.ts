export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle OAuth errors
    if (error) {
      console.error("[SumUp OAuth] Error:", error);
      return NextResponse.redirect(
        new URL(`/settings?sumup_error=${encodeURIComponent(error)}`, request.url)
      );
    }

    // Check for authorization code
    if (!code || !state) {
      console.error("[SumUp OAuth] Missing code or state");
      return NextResponse.redirect(
        new URL("/settings?sumup_error=missing_parameters", request.url)
      );
    }

    // Store the code and state for the frontend to process
    // We'll let the frontend handle the token exchange to avoid exposing client secret
    const callbackData = {
      code,
      state,
      timestamp: Date.now(),
    };

    // Store in sessionStorage temporarily (via cookie)
    const response = NextResponse.redirect(
      new URL("/settings?sumup_callback=success", request.url)
    );

    // Set a temporary cookie with the callback data
    response.cookies.set("sumup_oauth_callback", JSON.stringify(callbackData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 300, // 5 minutes
    });

    return response;
  } catch (error) {
    console.error("[SumUp OAuth] Callback error:", error);
    return NextResponse.redirect(
      new URL("/settings?sumup_error=callback_failed", request.url)
    );
  }
}
