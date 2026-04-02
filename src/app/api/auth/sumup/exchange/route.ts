import { NextRequest, NextResponse } from "next/server";
import { SumUpClient } from "@penkey/sumup";

export async function POST(request: NextRequest) {
  try {
    const { code, state } = await request.json();

    if (!code || !state) {
      return NextResponse.json(
        { error: "Authorization code and state are required" },
        { status: 400 }
      );
    }

    // Get OAuth configuration from environment
    const clientId = process.env.SUMUP_CLIENT_ID;
    const clientSecret = process.env.SUMUP_CLIENT_SECRET;
    const redirectUri = process.env.SUMUP_REDIRECT_URI || 
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/sumup/callback`;

    if (!clientId || !clientSecret) {
      console.error("[SumUp OAuth] Missing client credentials");
      return NextResponse.json(
        { error: "OAuth not configured on server" },
        { status: 500 }
      );
    }

    // Create SumUp client
    const client = new SumUpClient({
      clientId,
      clientSecret,
      redirectUri,
      environment: "production", // Can be made configurable
    });

    // Exchange code for token
    const tokenData = await client.exchangeCodeForToken(code, state);

    // Return token data (excluding sensitive client secret)
    return NextResponse.json({
      success: true,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope,
      merchantCode: client.config.merchantCode,
    });
  } catch (error) {
    console.error("[SumUp OAuth] Token exchange error:", error);
    return NextResponse.json(
      { 
        error: (error as Error).message,
        success: false 
      },
      { status: 500 }
    );
  }
}
