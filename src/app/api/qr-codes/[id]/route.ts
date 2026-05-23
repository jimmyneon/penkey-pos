import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET /api/qr-codes/[id] - Get single QR code
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { id } = params;
    
    const { data: qrCode, error } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error fetching QR code:', error);
      return NextResponse.json({ error: 'QR code not found' }, { status: 404 });
    }
    
    return NextResponse.json({ qr_code: qrCode });
  } catch (error) {
    console.error('Error in GET /api/qr-codes/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/qr-codes/[id] - Update QR code
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { id } = params;
    const body = await request.json();
    
    const { name, target_url, is_active, config } = body;
    
    const { data: qrCode, error } = await supabase
      .from('qr_codes')
      .update({
        ...(name !== undefined && { name }),
        ...(target_url !== undefined && { target_url }),
        ...(is_active !== undefined && { is_active }),
        ...(config !== undefined && { config }),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating QR code:', error);
      return NextResponse.json({ error: 'Failed to update QR code' }, { status: 500 });
    }
    
    return NextResponse.json({ qr_code: qrCode });
  } catch (error) {
    console.error('Error in PATCH /api/qr-codes/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/qr-codes/[id] - Delete QR code
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { id } = params;
    
    const { error } = await supabase
      .from('qr_codes')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting QR code:', error);
      return NextResponse.json({ error: 'Failed to delete QR code' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/qr-codes/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
