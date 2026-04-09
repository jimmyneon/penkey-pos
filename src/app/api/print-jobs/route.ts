export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";

// GET - List print jobs
export async function GET(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const printer_id = searchParams.get('printer_id');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createSupabaseServerClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from("print_jobs")
      .select("*, printers(name)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (printer_id) {
      query = query.eq("printer_id", printer_id);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ jobs: data || [] });
  } catch (error: any) {
    console.error("Failed to fetch print jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch print jobs" },
      { status: 500 }
    );
  }
}

// POST - Create a test print job
export async function POST(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  try {
    const { printer_id } = await request.json();

    if (!printer_id) {
      return NextResponse.json(
        { error: "Printer ID is required" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createSupabaseServerClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("print_jobs")
      .insert({
        printer_id,
        job_type: "test",
        template: "test",
        data: { 
          storeName: "Penkey Délicaf & Gifts",
          dateTime: new Date().toLocaleString("en-GB"),
        },
        priority: "normal",
        status: "pending",
        attempts: 0,
        max_attempts: 3,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ job: data }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create test print job:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create test print job" },
      { status: 500 }
    );
  }
}

// PATCH - Retry or cancel a job
export async function PATCH(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  try {
    const { job_id, action } = await request.json();

    if (!job_id || !action) {
      return NextResponse.json(
        { error: "Job ID and action are required" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createSupabaseServerClient(supabaseUrl, supabaseKey);

    let update = {};
    
    if (action === 'retry') {
      update = {
        status: 'pending',
        attempts: 0,
        error_message: null,
      };
    } else if (action === 'cancel') {
      update = { status: 'cancelled' };
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'retry' or 'cancel'" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("print_jobs")
      .update(update)
      .eq("id", job_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ job: data });
  } catch (error: any) {
    console.error("Failed to update print job:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update print job" },
      { status: 500 }
    );
  }
}
