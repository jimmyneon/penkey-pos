import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET /api/qr-codes - List QR codes for organization
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get org_id from query params (from authenticated session)
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    
    if (!orgId) {
      return NextResponse.json({ error: 'org_id is required' }, { status: 400 });
    }
    
    const { data: qrCodes, error } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching QR codes:', error);
      return NextResponse.json({ error: 'Failed to fetch QR codes' }, { status: 500 });
    }
    
    return NextResponse.json({ qr_codes: qrCodes });
  } catch (error) {
    console.error('Error in GET /api/qr-codes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/qr-codes - Create new QR code
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();
    
    const { org_id, store_id, code_type, name, target_url, config } = body;
    
    // Validate required fields
    if (!org_id || !code_type || !name || !target_url) {
      return NextResponse.json(
        { error: 'Missing required fields: org_id, code_type, name, target_url' },
        { status: 400 }
      );
    }
    
    // Validate code_type
    const validTypes = ['google_review', 'website', 'custom'];
    if (!validTypes.includes(code_type)) {
      return NextResponse.json(
        { error: `Invalid code_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Generate unique short code (8 characters)
    let uniqueCode: string;
    let codeExists = true;
    let attempts = 0;
    
    while (codeExists && attempts < 10) {
      uniqueCode = nanoid(8).toUpperCase();
      const { data: existing } = await supabase
        .from('qr_codes')
        .select('id')
        .eq('unique_code', uniqueCode)
        .single();
      
      codeExists = !!existing;
      attempts++;
    }
    
    if (codeExists) {
      return NextResponse.json(
        { error: 'Failed to generate unique code' },
        { status: 500 }
      );
    }
    
    const { data: qrCode, error } = await supabase
      .from('qr_codes')
      .insert({
        org_id,
        store_id: store_id || null,
        code_type,
        name,
        target_url,
        unique_code: uniqueCode!,
        is_active: true,
        config: config || {},
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating QR code:', error);
      return NextResponse.json({ error: 'Failed to create QR code' }, { status: 500 });
    }
    
    return NextResponse.json({ qr_code: qrCode }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/qr-codes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
