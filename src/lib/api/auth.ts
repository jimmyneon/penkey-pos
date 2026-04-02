import { NextRequest, NextResponse } from 'next/server';

export interface POSSession {
  user_id: string;
  org_id: string;
  register?: {
    id: string;
    name: string;
  };
}

export async function validatePOSSession(request: NextRequest): Promise<POSSession | null> {
  try {
    // ✅ SECURITY: Get session from httpOnly cookie (cannot be accessed by JavaScript)
    const sessionCookie = request.cookies.get('pos_session');
    if (!sessionCookie) {
      console.warn('[validatePOSSession] No pos_session cookie found');
      return null;
    }

    const session: POSSession = JSON.parse(sessionCookie.value);
    
    // Validate required fields
    if (!session.user_id || !session.org_id) {
      console.warn('[validatePOSSession] Missing required fields:', { user_id: !!session.user_id, org_id: !!session.org_id });
      return null;
    }

    // TODO: Optionally verify session against database for extra security
    // const supabase = createSupabaseServerClient(...);
    // const { data } = await supabase
    //   .from('user_sessions')
    //   .select('*')
    //   .eq('user_id', session.user_id)
    //   .eq('org_id', session.org_id)
    //   .single();
    // if (!data) return null;

    return session;
  } catch (error) {
    console.error('[validatePOSSession] Error:', error);
    return null;
  }
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: 'Unauthorized - Invalid or missing session' },
    { status: 401 }
  );
}
