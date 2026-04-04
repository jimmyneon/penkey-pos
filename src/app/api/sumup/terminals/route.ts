import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
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
  try {
    const { searchParams } = new URL(request.url);
    const terminalId = searchParams.get('id');

    if (!terminalId) {
      return NextResponse.json(
        { error: 'Terminal ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
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
      message: 'Terminal deleted successfully',
    });

  } catch (error) {
    console.error('Delete terminal error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
