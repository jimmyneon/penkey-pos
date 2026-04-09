export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';
import { getStoredSumUpCredentials } from '../credentials/route';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: terminals, error } = await supabase
      .from('terminals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch terminals' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      terminals,
    });

  } catch (error) {
    console.error('Get terminals error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const terminalId = searchParams.get('id');

    if (!terminalId) {
      return NextResponse.json(
        { error: 'Terminal ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch terminal to get reader_id
    const { data: terminal, error: fetchError } = await supabase
      .from('terminals')
      .select('reader_id')
      .eq('id', terminalId)
      .single() as any;

    if (fetchError || !terminal) {
      console.error('Database error fetching terminal:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch terminal' },
        { status: 500 }
      );
    }

    // Unpair from SumUp API
    const creds = await getStoredSumUpCredentials(session.org_id);
    if (creds) {
      const apiBase = process.env.SUMUP_API_BASE || 'https://api.sumup.com';
      try {
        const sumupResponse = await fetch(
          `${apiBase}/v0.1/merchants/${creds.merchant_code}/readers/${terminal.reader_id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${creds.api_key}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!sumupResponse.ok) {
          console.error('Failed to unpair from SumUp:', await sumupResponse.text());
          // Continue with local delete even if SumUp unpair fails
        }
      } catch (e) {
        console.error('Error unpairing from SumUp:', e);
        // Continue with local delete even if SumUp unpair fails
      }
    }

    // Delete from local database
    const { error } = await supabase
      .from('terminals')
      .delete()
      .eq('id', terminalId);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to delete terminal' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Terminal unpaired and removed',
    });

  } catch (error) {
    console.error('Delete terminal error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
