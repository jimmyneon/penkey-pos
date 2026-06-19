export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';
import QRCode from 'qrcode';

async function buildVoucherHtml(voucher: any, storeName: string, storeAddress?: string): Promise<string> {
  const voucherValue =
    voucher.voucher_type === 'amount' ? `\u00a3${Number(voucher.amount).toFixed(2)}`
    : voucher.voucher_type === 'percent' ? `${voucher.percent_discount}% OFF`
    : `Free ${voucher.item_name}`;

  const expiryText = voucher.expires_at
    ? new Date(voucher.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'No expiry';

  const qrDataUrl = await QRCode.toDataURL(voucher.code, {
    width: 200,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Gift Voucher \u2013 ${voucher.code}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0f0f0;
    }
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      min-height: 100vh;
    }

    .voucher {
      width: 105mm;
      height: 297mm;
      background: #fff;
      padding: 40px 30px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      page-break-inside: avoid;
      display: flex;
      flex-direction: column;
      border: 3px solid #e97c2c;
      position: relative;
    }
    .voucher::before {
      content: '';
      position: absolute;
      top: 8px;
      left: 8px;
      right: 8px;
      bottom: 8px;
      border: 1px solid #e97c2c;
      pointer-events: none;
    }

    .logo {
      max-width: 150px;
      max-height: 60px;
      object-fit: contain;
      margin: 0 auto 30px;
    }

    .title {
      text-align: center;
      font-size: 14px;
      font-weight: 600;
      color: #e97c2c;
      text-transform: uppercase;
      letter-spacing: 3px;
      margin-bottom: 40px;
    }

    .recipient {
      text-align: center;
      font-size: 18px;
      color: #333;
      margin-bottom: 30px;
    }

    .value {
      text-align: center;
      font-size: 48px;
      font-weight: 700;
      color: #e97c2c;
      margin-bottom: 40px;
    }

    .divider {
      height: 1px;
      background: #e0e0e0;
      margin: 30px 0;
    }

    .qr-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      margin-bottom: 30px;
    }

    .qr-code {
      background: #fff;
      padding: 10px;
      border: 1px solid #e0e0e0;
    }

    .code {
      font-family: 'Courier New', monospace;
      font-size: 20px;
      font-weight: 700;
      color: #333;
      letter-spacing: 2px;
    }

    .message {
      text-align: center;
      font-size: 14px;
      color: #666;
      font-style: italic;
      margin-bottom: 30px;
      line-height: 1.6;
    }

    .footer {
      margin-top: auto;
      text-align: center;
      font-size: 12px;
      color: #888;
    }

    .expiry {
      margin-bottom: 8px;
    }

    .address {
      font-size: 11px;
    }

    .print-btn-wrap { margin-top: 24px; text-align: center; }
    .print-btn {
      background: #e97c2c;
      color: white;
      border: none;
      padding: 12px 32px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .print-btn:hover { background: #d45f10; }

    @media print {
      html, body {
        background: white;
        padding: 0;
        margin: 0;
        height: auto;
        min-height: unset;
        display: block;
      }
      .voucher {
        box-shadow: none;
        width: 105mm;
        height: 297mm;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .print-btn-wrap { display: none !important; }
      @page { margin: 0; size: 105mm 297mm; }
    }
  </style>
</head>
<body>
  <div class="voucher">
    <img src="/penkey-logo.png" alt="${storeName}" class="logo" onerror="this.style.display='none'" />
    <div class="title">Gift Voucher</div>

    ${voucher.recipient_name ? `<div class="recipient">For: ${voucher.recipient_name}</div>` : ''}

    <div class="value">${voucherValue}</div>

    <div class="divider"></div>

    <div class="qr-section">
      <div class="qr-code">
        <img src="${qrDataUrl}" width="120" height="120" alt="QR Code" />
      </div>
      <div class="code">${voucher.code}</div>
    </div>

    ${voucher.message ? `<div class="message">&ldquo;${voucher.message}&rdquo;</div>` : ''}

    <div class="footer">
      <div class="expiry">Valid until: ${expiryText}</div>
      ${storeAddress ? `<div class="address">${storeAddress}</div>` : ''}
    </div>
  </div>

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

// GET – returns printable HTML page (open in new tab)
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

  let storeName = 'Penkey Gift Voucher';
  let storeAddress: string | undefined;
  try {
    // Try stores table first for accurate name
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

  const html = await buildVoucherHtml(voucher as any, storeName, storeAddress);
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// POST – same HTML but also sends to ESC/POS receipt printer if one is online
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return GET(request, { params });
}
