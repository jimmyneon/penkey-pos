export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";

// Simple test endpoint to check database connectivity and table existence
export async function GET(request: NextRequest) {
  try {
    console.log('[Printers Test] Starting test endpoint');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    console.log('[Printers Test] Supabase config:', { url: !!supabaseUrl, key: !!supabaseKey });

    const supabase = createSupabaseServerClient(supabaseUrl, supabaseKey);

    // Test 1: Check if printers table exists
    console.log('[Printers Test] Checking if printers table exists');
    const { data: printersData, error: printersError } = await supabase
      .from("printers")
      .select("id")
      .limit(1);

    console.log('[Printers Test] Printers table check:', { data: !!printersData, error: printersError?.message });

    // Test 2: Check if print_jobs table exists
    console.log('[Printers Test] Checking if print_jobs table exists');
    const { data: jobsData, error: jobsError } = await supabase
      .from("print_jobs")
      .select("id")
      .limit(1);

    console.log('[Printers Test] Print jobs table check:', { data: !!jobsData, error: jobsError?.message });

    return NextResponse.json({
      success: true,
      printersTable: { exists: !!printersData, error: printersError?.message },
      printJobsTable: { exists: !!jobsData, error: jobsError?.message },
      printersCount: printersData?.length || 0,
      jobsCount: jobsData?.length || 0,
    });
  } catch (error: any) {
    console.error('[Printers Test] Error:', error);
    return NextResponse.json(
      { error: error.message || "Test failed" },
      { status: 500 }
    );
  }
}
