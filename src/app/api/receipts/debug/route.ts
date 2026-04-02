import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@penkey/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized GET /api/receipts/debug`);
    return unauthorizedResponse();
  }

  // ✅ SECURITY: Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const receiptId = searchParams.get("receipt_id");

    if (!receiptId) {
      return NextResponse.json(
        { error: "Receipt ID is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get receipt
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select("*")
      .eq("id", receiptId)
      .single();

    if (receiptError) {
      return NextResponse.json({ error: receiptError.message }, { status: 500 });
    }

    // Get receipt lines
    const { data: lines, error: linesError } = await supabase
      .from("receipt_lines")
      .select("*")
      .eq("receipt_id", receiptId);

    if (linesError) {
      return NextResponse.json({ error: linesError.message }, { status: 500 });
    }

    // Get payments
    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("*")
      .eq("receipt_id", receiptId);

    if (paymentsError) {
      return NextResponse.json({ error: paymentsError.message }, { status: 500 });
    }

    return NextResponse.json({
      receipt,
      lines,
      payments,
      line_count: lines?.length || 0,
    });
  } catch (error: any) {
    console.error("Debug error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
