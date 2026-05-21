export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Validate session
  const session = await validatePOSSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createSupabaseServerClient(supabaseUrl, supabaseKey);

    const { command } = await request.json();
    const printerId = params.id;

    if (!command || !['restart', 'test_print', 'update'].includes(command)) {
      return NextResponse.json(
        { error: "Invalid command. Must be 'restart', 'test_print', or 'update'" },
        { status: 400 }
      );
    }

    // Update printer config with command
    const config: Record<string, any> = { 
      command, 
      timestamp: new Date().toISOString() 
    };
    
    const { error } = await (supabase
      .from("printers") as any)
      .update({ config })
      .eq("id", printerId);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: `Command '${command}' sent to printer`,
    });
  } catch (error: any) {
    console.error("Failed to send printer command:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to send command" },
      { status: 500 }
    );
  }
}
