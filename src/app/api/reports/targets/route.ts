export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized GET /api/reports/targets`);
    return unauthorizedResponse();
  }

  // ✅ SECURITY: Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("org_id");

    // ✅ SECURITY: Verify org_id matches session
    if (!orgId || orgId !== session.org_id) {
      console.warn(`[API-AUTH] Org mismatch - Request: ${orgId}, Session: ${session.org_id}`);
      return unauthorizedResponse();
    }

    // Get active sales targets
    const { data: targets, error: targetsError } = await (supabase as any)
      .rpc("get_active_sales_target", {
        p_org_id: orgId,
        p_store_id: null,
        p_member_id: null,
        p_date: new Date().toISOString().split('T')[0]
      });

    if (targetsError) {
      console.error("[Targets API] Error fetching targets:", targetsError);
      // Return default targets if function doesn't exist yet
      return NextResponse.json({
        targets: {
          daily_target: 150.00,
          weekly_target: 800.00,
          monthly_target: 3000.00,
          yearly_target: 36000.00
        }
      });
    }

    // If no targets found, return defaults
    const activeTargets = targets && (targets as any).length > 0 ? (targets as any)[0] : {
      daily_target: 150.00,
      weekly_target: 800.00,
      monthly_target: 3000.00,
      yearly_target: 36000.00
    };

    return NextResponse.json({
      targets: activeTargets
    });
  } catch (error) {
    console.error("[Targets API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch targets" },
      { status: 500 }
    );
  }
}

// POST endpoint to update targets
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { org_id, daily_target, weekly_target, monthly_target, yearly_target } = body;

    if (!org_id) {
      return NextResponse.json({ error: "org_id required" }, { status: 400 });
    }

    // Check if targets exist for this org
    const { data: existing } = await supabase
      .from("sales_targets")
      .select("id")
      .eq("org_id", org_id)
      .is("store_id", null)
      .is("member_id", null)
      .single();

    if (existing) {
      // Update existing targets
      const { error: updateError } = await (supabase as any)
        .from("sales_targets")
        .update({
          daily_target,
          weekly_target,
          monthly_target,
          yearly_target,
          updated_at: new Date().toISOString()
        })
        .eq("id", (existing as any).id);

      if (updateError) {
        console.error("[Targets API] Error updating targets:", updateError);
        return NextResponse.json({ error: "Failed to update targets" }, { status: 500 });
      }
    } else {
      // Insert new targets
      const { error: insertError } = await (supabase as any)
        .from("sales_targets")
        .insert({
          org_id,
          daily_target,
          weekly_target,
          monthly_target,
          yearly_target
        });

      if (insertError) {
        console.error("[Targets API] Error inserting targets:", insertError);
        return NextResponse.json({ error: "Failed to create targets" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Targets API] Error:", error);
    return NextResponse.json(
      { error: "Failed to save targets" },
      { status: 500 }
    );
  }
}
