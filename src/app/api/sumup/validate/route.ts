import { NextRequest, NextResponse } from "next/server";
import { SumUpClient } from "@penkey/sumup";

export async function POST(request: NextRequest) {
  try {
    const { apiKey, merchantCode, affiliateKey, appId } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    // Create SumUp client with provided credentials
    const client = new SumUpClient({
      apiKey,
      merchantCode: merchantCode || "unknown",
      affiliateKey: affiliateKey || "",
      appId: appId || "com.penkey.pos",
      environment: "production", // Can be made configurable
    });

    // Validate the API key
    const validation = await client.validateApiKey();

    if (validation.valid) {
      // Try to get readers as additional validation
      let readers: any[] = [];
      try {
        if (validation.merchantCode) {
          readers = await client.getReaders();
        }
      } catch (readerError) {
        console.warn("Failed to fetch readers:", readerError);
      }

      return NextResponse.json({
        valid: true,
        merchantCode: validation.merchantCode,
        readers,
        message: "SumUp credentials are valid",
      });
    } else {
      return NextResponse.json(
        {
          valid: false,
          error: validation.error,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("SumUp validation error:", error);
    return NextResponse.json(
      {
        valid: false,
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
