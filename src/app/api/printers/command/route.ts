export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";

/**
 * Send a command to a printer (restart, test_print, etc.)
 * The print server subscribes to printer config changes and acts on commands.
 * Systemd restarts the service automatically after a clean exit.
 */
export async function POST(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  try {
    const { printer_id, command } = await request.json();

    if (!printer_id || !command) {
      return NextResponse.json(
        { error: "printer_id and command are required" },
        { status: 400 }
      );
    }

    const allowedCommands = ["restart", "test_print"];
    if (!allowedCommands.includes(command)) {
      return NextResponse.json(
        { error: `Invalid command. Allowed: ${allowedCommands.join(", ")}` },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createSupabaseServerClient(supabaseUrl, supabaseKey);

    // Write command to printer config — the print server watches for this
    const { error } = await supabase
      .from("printers")
      .update({ config: { command } })
      .eq("id", printer_id);

    if (error) throw error;

    // Clear the command after a short delay so it doesn't re-trigger
    setTimeout(async () => {
      try {
        await supabase
          .from("printers")
          .update({ config: { command: null } })
          .eq("id", printer_id);
      } catch {}
    }, 5000);

    return NextResponse.json({
      success: true,
      message: command === "restart"
        ? "Restart command sent. Print server will restart in ~10 seconds."
        : "Command sent to printer.",
    });
  } catch (error: any) {
    console.error("Failed to send printer command:", error);
    return NextResponse.json(
      { error: "Failed to send command", details: error?.message },
      { status: 500 }
    );
  }
}
