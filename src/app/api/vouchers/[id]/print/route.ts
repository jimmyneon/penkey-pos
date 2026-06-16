export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';
import { getPrinters, createPrintJob } from '@/lib/services/print-queue';

function pad(str: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
  const s = String(str).substring(0, width);
  const spaces = width - s.length;
  if (align === 'center') {
    const l = Math.floor(spaces / 2);
    const r = spaces - l;
    return ' '.repeat(l) + s + ' '.repeat(r);
  }
  if (align === 'right') return ' '.repeat(spaces) + s;
  return s + ' '.repeat(spaces);
}

function line(char = '-', width = 42): string {
  return char.repeat(width);
}

function generateVoucherText(voucher: any, storeName: string): string {
  const W = 42;
  const rows: string[] = [];

  const voucherValue =
    voucher.voucher_type === 'amount' ? `\u00a3${Number(voucher.amount).toFixed(2)}`
    : voucher.voucher_type === 'percent' ? `${voucher.percent_discount}% OFF`
    : `FREE: ${voucher.item_name}`;

  rows.push('');
  rows.push(pad('*** GIFT VOUCHER ***', W, 'center'));
  rows.push(pad(storeName, W, 'center'));
  rows.push(line('-', W));
  rows.push('');
  rows.push(pad(voucherValue, W, 'center'));
  rows.push('');
  rows.push(line('-', W));

  rows.push(pad('CODE:', 10) + pad(voucher.code, W - 10, 'right'));

  if (voucher.recipient_name) {
    rows.push(pad('FOR:', 10) + pad(voucher.recipient_name, W - 10, 'right'));
  }

  if (voucher.expires_at) {
    const expiry = new Date(voucher.expires_at).toLocaleDateString('en-GB');
    rows.push(pad('EXPIRES:', 10) + pad(expiry, W - 10, 'right'));
  } else {
    rows.push(pad('EXPIRES:', 10) + pad('No expiry', W - 10, 'right'));
  }

  rows.push(line('-', W));

  if (voucher.message) {
    rows.push('');
    rows.push(pad(`"${voucher.message}"`, W, 'center'));
    rows.push('');
  }

  rows.push(pad('Present this voucher in-store to redeem.', W, 'center'));
  rows.push('');
  rows.push(pad('Thank you!', W, 'center'));
  rows.push('');
  rows.push('');

  return rows.join('\n');
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createSupabaseServerClient(supabaseUrl, supabaseKey);

  const { data: voucher, error } = await supabase
    .from('gift_vouchers')
    .select('*')
    .eq('id', params.id)
    .eq('org_id', session.org_id)
    .single();

  if (error || !voucher) {
    return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });
  }

  // Fetch store name
  let storeName = 'Penkey Delicaf & Gifts';
  try {
    const { data: template } = await supabase
      .from('print_templates')
      .select('template')
      .eq('org_id', session.org_id)
      .eq('type', 'receipt')
      .eq('is_default', true)
      .maybeSingle();
    if (template?.template) {
      storeName = template.template.split('\n')[0] || storeName;
    }
  } catch {}

  const voucherText = generateVoucherText(voucher as any, storeName);

  // Find a printer
  let printerId: string | null = null;
  try {
    const printers = await getPrinters(supabaseUrl, supabaseKey, { status: 'online' });
    if (printers.length > 0) printerId = printers[0].id;
  } catch {}

  if (!printerId) {
    return NextResponse.json({
      success: true,
      queued: false,
      message: 'No printer online – use browser print',
      voucher_text: voucherText,
    });
  }

  await createPrintJob(supabaseUrl, supabaseKey, {
    printer_id: printerId,
    type: 'receipt',
    org_id: session.org_id,
    data: {
      receipt_text: voucherText,
      printer_settings: { feed_lines: 4, width: 42, code_page: 19 },
    },
  });

  return NextResponse.json({ success: true, queued: true, printer_id: printerId });
}
