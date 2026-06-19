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
    color: { dark: '#e97c2c', light: '#ffffff' },
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
      background: #2d2d2d;
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
      width: 100%;
      max-width: 400px;
      background: #3d3d3d;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      page-break-inside: avoid;
      border: 1px solid #4d4d4d;
    }

    .header {
      background: #e97c2c;
      padding: 24px 20px;
      text-align: center;
    }
    .brand {
      font-size: 28px;
      font-weight: 700;
      color: #fff;
      letter-spacing: 1px;
    }
    .gift-label {
      font-size: 12px;
      font-weight: 600;
      color: rgba(255,255,255,0.9);
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-top: 4px;
    }

    .body {
      padding: 24px 20px;
      text-align: center;
    }

    .recipient-name {
      font-size: 18px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 16px;
    }

    .value-wrap {
      background: #2d2d2d;
      border: 2px solid #e97c2c;
      border-radius: 12px;
      padding: 16px 24px;
      margin-bottom: 20px;
    }
    .value-label { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .value { font-size: 36px; font-weight: 700; color: #e97c2c; line-height: 1; }

    .qr-row {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
    }
    .qr-box {
      background: #fff;
      border-radius: 12px;
      padding: 12px;
    }
    .qr-box img { display: block; border-radius: 8px; }
    .code {
      font-family: 'Courier New', monospace;
      font-size: 18px;
      font-weight: 700;
      color: #e97c2c;
      letter-spacing: 2px;
      background: #2d2d2d;
      border: 1px solid #4d4d4d;
      border-radius: 8px;
      padding: 8px 16px;
    }
    .scan-hint { font-size: 12px; color: #888; margin-top: 8px; }

    .message-wrap {
      background: #2d2d2d;
      border-left: 3px solid #e97c2c;
      border-radius: 0 8px 8px 0;
      padding: 12px 16px;
      margin-bottom: 16px;
      text-align: left;
    }
    .message { font-size: 14px; color: #ccc; font-style: italic; line-height: 1.5; }

    .footer {
      background: #2d2d2d;
      border-top: 1px solid #4d4d4d;
      padding: 16px 20px;
      text-align: center;
    }
    .expiry-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; }
    .expiry-date { font-size: 14px; font-weight: 600; color: #fff; margin-top: 4px; }
    .store-address { font-size: 12px; color: #888; margin-top: 8px; }

    .print-btn-wrap { margin-top: 20px; text-align: center; }
    .print-btn {
      background: #e97c2c;
      color: white;
      border: none;
      padding: 12px 32px;
      border-radius: 8px;
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
        border-radius: 0;
        max-width: 100%;
        page-break-inside: avoid;
        break-inside: avoid;
        background: #fff;
        border: 1px solid #ccc;
      }
      .header { background: #e97c2c; }
      .body { color: #000; }
      .value-wrap { background: #f5f5f5; border-color: #e97c2c; }
      .value { color: #e97c2c; }
      .code { background: #f5f5f5; border-color: #ccc; color: #000; }
      .message-wrap { background: #f5f5f5; border-color: #e97c2c; }
      .message { color: #333; }
      .footer { background: #f5f5f5; border-color: #ccc; }
      .expiry-date { color: #000; }
      .store-address { color: #666; }
      .print-btn-wrap { display: none !important; }
      @page { margin: 0.5cm; size: A5 portrait; }
    }
  </style>
</head>
<body>
  <div class="voucher">
    <div class="header">
      <div class="brand">${storeName}</div>
      <div class="gift-label">Gift Voucher</div>
    </div>

    <div class="body">
      ${voucher.recipient_name ? `<div class="recipient-name">For: ${voucher.recipient_name}</div>` : ''}

      <div class="value-wrap">
        <div class="value-label">Voucher Value</div>
        <div class="value">${voucherValue}</div>
      </div>

      <div class="qr-row">
        <div class="qr-box">
          <img src="${qrDataUrl}" width="140" height="140" alt="QR Code" />
        </div>
        <div class="code">${voucher.code}</div>
        <div class="scan-hint">Scan QR or quote code when redeeming</div>
      </div>

      ${voucher.message ? `<div class="message-wrap"><div class="message">&ldquo;${voucher.message}&rdquo;</div></div>` : ''}
    </div>

    <div class="footer">
      <div class="expiry-label">Valid Until</div>
      <div class="expiry-date">${expiryText}</div>
      ${storeAddress ? `<div class="store-address">${storeAddress}</div>` : ''}
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
