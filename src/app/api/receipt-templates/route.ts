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
      .from("print_templates")
      .select("*")
      .eq("org_id", session.org_id)
      .eq("type", "receipt")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Map print_templates format to UI format (split template into header/footer)
    const mappedTemplates = (data || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      header: t.template,
      footer: "Thank you for visiting",
      created_at: t.created_at
    }));

    return NextResponse.json({ templates: mappedTemplates });
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

    const body = await request.json();
    const { template } = body;

    console.log('[Receipt Templates] POST request received:', {
      hasTemplate: !!template,
      templateId: template?.id,
      templateName: template?.name,
      headerLength: template?.header?.length,
      headerPreview: template?.header?.substring(0, 50)
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template data required" },
        { status: 400 }
      );
    }

    let result;
    if (template.id) {
      console.log('[Receipt Templates] Updating existing template:', template.id);
      // Update existing template
      const { data, error } = await supabase
        .from("print_templates")
        .update({
          name: template.name,
          template: template.header, // Store header as template content
        })
        .eq("id", template.id)
        .eq("org_id", session.org_id) // Security: only update own templates
        .select()
        .single();

      if (error) {
        console.error('[Receipt Templates] Update error:', error);
        throw error;
      }
      console.log('[Receipt Templates] Template updated successfully:', {
        id: data.id,
        name: data.name,
        templatePreview: data.template?.substring(0, 50)
      });
      result = data;
    } else {
      // Create new template
      const { data, error } = await supabase
        .from("print_templates")
        .insert({
          org_id: session.org_id,
          name: template.name,
          type: "receipt",
          template: template.header, // Store header as template content
          paper_width: 80,
          is_default: false,
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
      .from("print_templates")
      .delete()
      .eq("id", id)
      .eq("org_id", session.org_id);

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
