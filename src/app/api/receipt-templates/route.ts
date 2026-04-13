import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";

// GET - List all receipt templates
export async function GET(request: NextRequest) {
  try {
    const session = await validatePOSSession(request);
    if (!session) {
      return unauthorizedResponse();
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("receipt_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ templates: data || [] });
  } catch (error: any) {
    console.error("Failed to fetch receipt templates:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch receipt templates" },
      { status: 500 }
    );
  }
}

// POST - Create or update a receipt template
export async function POST(request: NextRequest) {
  try {
    const session = await validatePOSSession(request);
    if (!session) {
      return unauthorizedResponse();
    }

    const template = await request.json();
    
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let result;
    if (template.id) {
      // Update existing template
      const { data, error } = await supabase
        .from("receipt_templates")
        .update({
          name: template.name,
          header: template.header,
          footer: template.footer,
        })
        .eq("id", template.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new template
      const { data, error } = await supabase
        .from("receipt_templates")
        .insert({
          name: template.name,
          header: template.header,
          footer: template.footer,
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return NextResponse.json({ template: result });
  } catch (error: any) {
    console.error("Failed to save receipt template:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save receipt template" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a receipt template
export async function DELETE(request: NextRequest) {
  try {
    const session = await validatePOSSession(request);
    if (!session) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from("receipt_templates")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete receipt template:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete receipt template" },
      { status: 500 }
    );
  }
}
