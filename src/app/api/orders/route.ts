export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';
import { createTicketPrintJob, getPrinters } from '@/lib/services/print-queue';
import { type TicketData } from '@penkey/print-adapters';
import { sendOrderNotificationEmail } from '@/lib/services/order-email';

export async function GET(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status');

  let query = supabase
    .from('orders')
    .select('*')
    .eq('org_id', session.org_id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (statusParam) {
    const statuses = statusParam.split(',');
    query = query.in('status', statuses);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[Orders GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: data });
}

export async function POST(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await request.json();
  const { customer_name, customer_email, customer_phone, lines, subtotal, tax_total, tip_amount, total, notes, dining_option, requested_for, source } = body;

  if (!lines || lines.length === 0) {
    return NextResponse.json({ error: 'No items in order' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('orders')
    .insert({
      org_id: session.org_id,
      source: source || 'online',
      customer_name: customer_name || null,
      customer_email: customer_email || null,
      customer_phone: customer_phone || null,
      lines,
      subtotal: subtotal || 0,
      tax_total: tax_total || 0,
      tip_amount: tip_amount || 0,
      total: total || 0,
      notes: notes || null,
      dining_option: dining_option || 'takeaway',
      requested_for: requested_for || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('[Orders POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Auto-print kitchen ticket for online orders
  try {
    await autoPrintKitchenTicket(data, session.org_id);
  } catch (printErr) {
    console.error('[Orders POST] Auto-print failed:', printErr);
  }

  // Send email notification about the new order
  try {
    await sendOrderNotificationEmail(data);
  } catch (emailErr) {
    console.error('[Orders POST] Email notification failed:', emailErr);
  }

  return NextResponse.json({ order: data }, { status: 201 });
}

async function autoPrintKitchenTicket(order: any, orgId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Find an online printer
  let printerId: string | null = null;
  try {
    const onlinePrinters = await getPrinters(supabaseUrl, supabaseKey, { status: 'online' });
    if (onlinePrinters.length > 0) {
      printerId = onlinePrinters[0].id;
    } else {
      const allPrinters = await getPrinters(supabaseUrl, supabaseKey);
      if (allPrinters.length > 0) {
        printerId = allPrinters[0].id;
      }
    }
  } catch (err) {
    console.warn('[Orders POST] Failed to lookup printers:', err);
  }

  if (!printerId) return;

  const now = new Date();
  const ticketData: TicketData = {
    store_name: 'PENKEY DELICAF',
    store_address: undefined,
    store_phone: undefined,
    ticket_name: `Order #${order.order_number}`,
    ticket_comment: order.notes || undefined,
    date: now.toLocaleDateString('en-GB'),
    time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    employee_name: 'Online Order',
    register_name: 'Online',
    lines: (order.lines || []).map((l: any) => ({
      quantity: l.quantity || 1,
      item_name: l.item_name || l.name || 'Item',
      variant_name: l.variant_name || null,
      modifiers: l.modifiers || [],
      line_total: l.line_total || ((l.unit_price || 0) * (l.quantity || 1)),
    })),
    subtotal: order.subtotal || 0,
    tax: order.tax_total || 0,
    total: order.total || 0,
    is_paid: false,
    dining_option: order.dining_option || 'takeaway',
    table_number: null,
    customer_name: order.customer_name || undefined,
    assignment: null,
  };

  await createTicketPrintJob(supabaseUrl, supabaseKey, printerId, ticketData, orgId);
  console.log('[Orders POST] Kitchen ticket queued for online order:', order.order_number);
}
