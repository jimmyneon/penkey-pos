import { NextRequest, NextResponse } from "next/server";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await validatePOSSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { email } = body || {};

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // TODO: Integrate with email provider (e.g. Resend, SendGrid).
    // For now, simulate success so POS flow works end-to-end.
    console.log(
      `[EMAIL] Would send receipt ${params.id} to ${email} for org ${session.org_id}`
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to send receipt email:", error);
    return NextResponse.json(
      { error: "Failed to send email", details: error.message },
      { status: 500 }
    );
  }
}
