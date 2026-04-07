export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextResponse, NextRequest } from 'next/server';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';
import { ratelimit } from '@/lib/ratelimit';

export async function GET(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized GET /api/items/associations`);
    return unauthorizedResponse();
  }

  // ✅ SECURITY: Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');
    const orgId = searchParams.get('orgId');
    
    // ✅ SECURITY: Verify org_id matches session
    if (!itemId || !orgId || orgId !== session.org_id) {
      console.warn(`[API-AUTH] Org mismatch - Request: ${orgId}, Session: ${session.org_id}`);
      return unauthorizedResponse();
    }

    const supabase = await createClient();
    
    // Call the database function to get real associations
    const { data: associations, error } = await (supabase as any)
      .rpc('calculate_item_associations', {
        p_org_id: orgId,
        p_days_back: 90,      // Last 90 days
        p_min_frequency: 2,   // Bought together at least 2 times
        p_min_confidence: 0.05 // 5% confidence minimum
      });

    if (error) {
      console.error('[Associations API] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter to only associations for the requested item
    const itemAssociations = (associations || [])
      .filter((assoc: any) => assoc.item_a_id === itemId)
      .sort((a: any, b: any) => b.confidence - a.confidence); // Sort by confidence

    console.log(`[Associations API] Found ${itemAssociations.length} associations for item ${itemId}`);

    return NextResponse.json({
      associations: itemAssociations,
      cached: false
    });
  } catch (error) {
    console.error('[Associations API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
