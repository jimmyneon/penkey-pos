export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { getPrinters, createPrinter, updatePrinter, deletePrinter } from "@/lib/services/print-queue";

// GET - List all printers
export async function GET(request: NextRequest) {
  try {
    const session = await validatePOSSession(request);
    if (!session) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const register_id = searchParams.get('register_id') || undefined;
    const store_id = searchParams.get('store_id') || undefined;
    const status = searchParams.get('status') as any || undefined;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const printers = await getPrinters(supabaseUrl, supabaseKey, {
      register_id,
      store_id,
      status,
    });

    return NextResponse.json({ printers });
  } catch (error: any) {
    console.error("Failed to fetch printers:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch printers" },
      { status: 500 }
    );
  }
}

// POST - Create a new printer
export async function POST(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  try {
    const config = await request.json();
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const printer = await createPrinter(supabaseUrl, supabaseKey, config);

    return NextResponse.json({ printer }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create printer:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create printer" },
      { status: 500 }
    );
  }
}

// PATCH - Update a printer
export async function PATCH(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  try {
    const { printer_id, updates } = await request.json();
    
    if (!printer_id) {
      return NextResponse.json(
        { error: "Printer ID is required" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const printer = await updatePrinter(supabaseUrl, supabaseKey, printer_id, updates);

    return NextResponse.json({ printer });
  } catch (error: any) {
    console.error("Failed to update printer:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update printer" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a printer
export async function DELETE(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const printer_id = searchParams.get('id');
    
    if (!printer_id) {
      return NextResponse.json(
        { error: "Printer ID is required" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    await deletePrinter(supabaseUrl, supabaseKey, printer_id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete printer:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete printer" },
      { status: 500 }
    );
  }
}
