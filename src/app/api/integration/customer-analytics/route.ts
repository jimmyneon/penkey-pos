import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function validateApiKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const apiKey = process.env.PERKS_API_KEY;
  if (!apiKey || !authHeader?.startsWith('Bearer ')) return false;
  return authHeader.substring(7) === apiKey;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get customer ID from query parameter instead of path
  const customerId = request.nextUrl.searchParams.get('customer_id');
  if (!customerId) {
    return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: receipts, error } = await supabase
    .from('receipts')
    .select(`
      id,
      receipt_number,
      total,
      subtotal,
      tax_total,
      discount_total,
      created_at,
      dining_option,
      receipt_lines (
        id,
        name,
        quantity,
        unit_price,
        line_total,
        modifiers,
        item_id
      )
    `)
    .eq('customer_id', customerId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }

  const receiptsList = receipts || [];
  const itemFrequency: Record<string, { name: string; count: number; totalSpent: number; item_id: string }> = {};
  
  receiptsList.forEach((receipt: any) => {
    receipt.receipt_lines?.forEach((line: any) => {
      const key = line.item_id || line.name;
      if (!itemFrequency[key]) {
        itemFrequency[key] = { name: line.name, count: 0, totalSpent: 0, item_id: line.item_id };
      }
      itemFrequency[key].count += line.quantity;
      itemFrequency[key].totalSpent += line.line_total;
    });
  });

  const topItems = Object.values(itemFrequency)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const totalSpent = receiptsList.reduce((sum: number, r: any) => sum + (r.total || 0), 0);
  const avgOrderValue = receiptsList.length > 0 ? totalSpent / receiptsList.length : 0;

  return NextResponse.json({
    totalPurchases: receiptsList.length,
    totalSpent,
    averageOrderValue: avgOrderValue,
    topFavorites: topItems,
    recentPurchases: receiptsList.slice(0, 10).map((r: any) => ({
      id: r.id,
      receipt_number: r.receipt_number,
      total: r.total,
      created_at: r.created_at,
      items: r.receipt_lines?.map((l: any) => l.name).join(', ') || ''
    }))
  });
}
