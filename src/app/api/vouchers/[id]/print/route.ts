export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';
import { generateVoucherPng } from '@/lib/voucher/voucher-template';

function buildPrintPageHtml(pngBase64: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Print Voucher</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #e8e4dc;
    }
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px;
      min-height: 100vh;
    }
    .voucher-img {
      width: 105mm;
      max-width: 100%;
      height: auto;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      border-radius: 4px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .print-btn-wrap { margin-top: 24px; text-align: center; }
    .print-btn {
      background: #1a2847;
      color: white;
      border: none;
      padding: 12px 32px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      box-shadow: 0 2px 8px rgba(26,40,71,0.3);
    }
    .print-btn:hover { background: #243556; }
    @media print {
      html, body { background: white; padding: 0; margin: 0; }
      .voucher-img { box-shadow: none; border-radius: 0; width: 105mm; }
      .print-btn-wrap { display: none !important; }
      @page { margin: 0; size: 105mm auto; }
    }
  </style>
</head>
<body>
  <img class="voucher-img" src="data:image/png;base64,${pngBase64}" alt="Voucher" />
  <div class="print-btn-wrap">
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <script>
    if (new URLSearchParams(window.location.search).get('autoprint') === '1') {
      window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 600); });
    }
  </script>
</body>
</html>`;
}

// GET – returns printable HTML page with the PNG voucher image
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: voucher, error } = await supabase
    .from('gift_vouchers')
    .select('*')
    .eq('id', params.id)
    .eq('org_id', session.org_id)
    .single();

  if (error || !voucher) {
    return new NextResponse('Voucher not found', { status: 404 });
  }

  let storeName = 'Penkey';
  let storeAddress: string | undefined;
  try {
    const { data: store } = await supabase
      .from('stores')
      .select('name, address')
      .eq('org_id', session.org_id)
      .limit(1)
      .maybeSingle();
    if ((store as any)?.name) {
      storeName = (store as any).name;
      storeAddress = (store as any).address || undefined;
    }
  } catch {}

  const v = voucher as any;
  const pngBuffer = await generateVoucherPng({
    code: v.code,
    voucher_type: v.voucher_type,
    amount: v.amount,
    percent_discount: v.percent_discount,
    item_name: v.item_name,
    recipient_name: v.recipient_name,
    recipient_email: v.recipient_email,
    message: v.message,
    expires_at: v.expires_at,
    storeName,
    storeAddress,
  });

  const html = buildPrintPageHtml(pngBuffer.toString('base64'));
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// POST – same as GET
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return GET(request, { params });
}
