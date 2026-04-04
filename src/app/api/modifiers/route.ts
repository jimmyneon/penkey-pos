import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("org_id");

    if (!orgId) {
      return NextResponse.json(
        { error: "org_id is required" },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch modifier groups with their options
    const { data: groups, error: groupsError } = await supabase
      .from("modifier_groups")
      .select(`
        id,
        name,
        selection_type,
        min_selections,
        max_selections,
        modifier_options (
          id,
          name,
          price_adjustment,
          is_default,
          sort_order,
          is_active
        )
      `)
      .eq("org_id", orgId)
      .order("name");

    console.log("[API /modifiers] Raw groups data:", JSON.stringify(groups, null, 2));

    if (groupsError) {
      console.error("Supabase error:", groupsError);
      return NextResponse.json({ error: groupsError.message }, { status: 500 });
    }

    // Filter to only include active options and flatten for simple display
    const modifiers = (groups || []).flatMap((group: any) => 
      (group.modifier_options || [])
        .filter((opt: any) => opt.is_active)
        .map((opt: any) => ({
          id: opt.id,
          name: opt.name,
          price: opt.price_adjustment,
          description: group.name, // Use group name as description
          group_id: group.id,
          group_name: group.name,
          is_active: true
        }))
    );

    console.log("[API /modifiers] Flattened modifiers:", modifiers.length, modifiers);

    return NextResponse.json(modifiers);
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
