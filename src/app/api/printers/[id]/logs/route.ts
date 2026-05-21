export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";

export async function GET(
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

    const printerId = params.id;
    const { searchParams } = new URL(request.url);
    
    // Query parameters
    const level = searchParams.get('level'); // Filter by log level
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const since = searchParams.get('since'); // ISO timestamp
    const search = searchParams.get('search'); // Search in message

    // Build query
    let query = (supabase
      .from('printer_logs') as any)
      .select('*', { count: 'exact' })
      .eq('printer_id', printerId)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (level) {
      query = query.eq('level', level.toUpperCase());
    }

    if (since) {
      query = query.gte('timestamp', since);
    }

    if (search) {
      query = query.ilike('message', `%${search}%`);
    }

    const { data: logs, error, count } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      logs: logs || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("Failed to fetch printer logs:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch logs" },
      { status: 500 }
    );
  }
}

// Delete old logs
export async function DELETE(
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

    const printerId = params.id;
    const { searchParams } = new URL(request.url);
    const before = searchParams.get('before'); // Delete logs before this timestamp

    if (!before) {
      return NextResponse.json(
        { error: "Missing 'before' parameter (ISO timestamp)" },
        { status: 400 }
      );
    }

    const { error } = await (supabase
      .from('printer_logs') as any)
      .delete()
      .eq('printer_id', printerId)
      .lt('timestamp', before);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: `Deleted logs before ${before}`,
    });
  } catch (error: any) {
    console.error("Failed to delete printer logs:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete logs" },
      { status: 500 }
    );
  }
}
