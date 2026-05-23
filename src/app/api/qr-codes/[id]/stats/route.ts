import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET /api/qr-codes/[id]/stats - Get scan statistics for QR code
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { id } = params;
    
    // Get total scans
    const { data: totalScans, error: totalError } = await supabase
      .from('qr_scans')
      .select('id', { count: 'exact', head: true })
      .eq('qr_code_id', id);
    
    if (totalError) {
      console.error('Error fetching total scans:', totalError);
      return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
    }
    
    // Get scans by date (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: scansByDate, error: dateError } = await supabase
      .from('qr_scans')
      .select('scanned_at')
      .eq('qr_code_id', id)
      .gte('scanned_at', thirtyDaysAgo.toISOString())
      .order('scanned_at', { ascending: true });
    
    if (dateError) {
      console.error('Error fetching scans by date:', dateError);
    }
    
    // Group by date
    const scansByDay: Record<string, number> = {};
    scansByDate?.forEach((scan) => {
      const date = new Date(scan.scanned_at).toISOString().split('T')[0];
      scansByDay[date] = (scansByDay[date] || 0) + 1;
    });
    
    // Get scans by store
    const { data: scansByStore, error: storeError } = await supabase
      .from('qr_scans')
      .select('store_id')
      .eq('qr_code_id', id);
    
    if (storeError) {
      console.error('Error fetching scans by store:', storeError);
    }
    
    const storeCounts: Record<string, number> = {};
    scansByStore?.forEach((scan) => {
      if (scan.store_id) {
        storeCounts[scan.store_id] = (storeCounts[scan.store_id] || 0) + 1;
      }
    });
    
    // Get recent scans (last 10)
    const { data: recentScans, error: recentError } = await supabase
      .from('qr_scans')
      .select('*')
      .eq('qr_code_id', id)
      .order('scanned_at', { ascending: false })
      .limit(10);
    
    if (recentError) {
      console.error('Error fetching recent scans:', recentError);
    }
    
    return NextResponse.json({
      stats: {
        total_scans: totalScans || 0,
        scans_by_day: scansByDay,
        scans_by_store: storeCounts,
        recent_scans: recentScans || [],
      },
    });
  } catch (error) {
    console.error('Error in GET /api/qr-codes/[id]/stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
