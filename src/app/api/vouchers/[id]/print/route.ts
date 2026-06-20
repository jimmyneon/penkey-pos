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

  const voucherSubtext =
    voucher.voucher_type === 'amount' ? 'This voucher can be redeemed for goods to the value shown.'
    : voucher.voucher_type === 'percent' ? 'This voucher gives the stated percentage off your order.'
    : `This voucher entitles the bearer to one free ${voucher.item_name}.`;

  const expiryText = voucher.expires_at
    ? new Date(voucher.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'No expiry';

  const qrDataUrl = await QRCode.toDataURL(voucher.code, {
    width: 240,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });

  const createdDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

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
      padding: 0;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      page-break-inside: avoid;
      display: flex;
      flex-direction: column;
      border: 3px solid #e97c2c;
      position: relative;
      overflow: hidden;
    }
    .voucher::before {
      content: '';
      position: absolute;
      top: 6px;
      left: 6px;
      right: 6px;
      bottom: 6px;
      border: 1px solid #e97c2c;
      pointer-events: none;
      z-index: 1;
    }

    .header-band {
      background: linear-gradient(135deg, #e97c2c 0%, #d45f10 100%);
      padding: 24px 30px 20px;
      text-align: center;
      position: relative;
    }
    .header-band::after {
      content: '';
      position: absolute;
      bottom: -10px;
      left: 0;
      right: 0;
      height: 20px;
      background: #fff;
      border-radius: 50% 50% 0 0 / 100% 100% 0 0;
      transform: scaleX(1.2);
    }
    .logo {
      max-width: 140px;
      max-height: 50px;
      object-fit: contain;
      margin: 0 auto 6px;
      display: block;
    }
    .brand-name {
      font-size: 22px;
      font-weight: 800;
      color: #fff;
      letter-spacing: -0.5px;
    }
    .brand-tagline {
      font-size: 10px;
      color: rgba(255,255,255,0.8);
      text-transform: uppercase;
      letter-spacing: 3px;
      margin-top: 2px;
    }

    .body {
      padding: 30px 30px 20px;
      flex: 1;
      display: flex;
      flex-direction: column;
      position: relative;
      z-index: 2;
    }

    .title {
      text-align: center;
      font-size: 12px;
      font-weight: 600;
      color: #e97c2c;
      text-transform: uppercase;
      letter-spacing: 4px;
      margin-bottom: 20px;
    }

    .recipient {
      text-align: center;
      font-size: 15px;
      color: #555;
      margin-bottom: 16px;
    }
    .recipient strong { color: #333; font-weight: 600; }

    .value-box {
      text-align: center;
      padding: 20px 0;
      margin-bottom: 16px;
    }
    .value {
      font-size: 52px;
      font-weight: 800;
      color: #e97c2c;
      line-height: 1;
    }
    .value-subtext {
      font-size: 11px;
      color: #888;
      margin-top: 10px;
      line-height: 1.5;
      max-width: 260px;
      margin-left: auto;
      margin-right: auto;
    }

    .dashed-divider {
      border: none;
      border-top: 2px dashed #ddd;
      margin: 16px 0;
    }

    .qr-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .qr-code {
      background: #fff;
      padding: 8px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
    }
    .code-label {
      font-size: 9px;
      color: #aaa;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .code {
      font-family: 'Courier New', monospace;
      font-size: 22px;
      font-weight: 700;
      color: #333;
      letter-spacing: 3px;
    }

    .message {
      text-align: center;
      font-size: 13px;
      color: #666;
      font-style: italic;
      margin-bottom: 16px;
      line-height: 1.6;
      padding: 0 10px;
    }

    .terms {
      margin-top: auto;
      padding-top: 16px;
    }
    .terms-divider {
      border: none;
      border-top: 1px solid #eee;
      margin-bottom: 12px;
    }
    .terms-list {
      font-size: 9px;
      color: #999;
      line-height: 1.6;
      padding: 0 5px;
    }
    .terms-list p { margin-bottom: 3px; }

    .footer {
      text-align: center;
      font-size: 11px;
      color: #888;
      padding: 12px 30px 20px;
      background: #fafafa;
      border-top: 1px solid #eee;
      position: relative;
      z-index: 2;
    }
    .expiry { margin-bottom: 4px; font-weight: 600; color: #555; }
    .address { font-size: 10px; color: #aaa; }
    .issued { font-size: 9px; color: #ccc; margin-top: 4px; }

    .print-btn-wrap { margin-top: 24px; text-align: center; }
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
      box-shadow: 0 2px 8px rgba(233,124,44,0.3);
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
    <div class="header-band">
      <img src="/penkey-logo.png" alt="${storeName}" class="logo" onerror="this.style.display='none'" />
      <div class="brand-name">${storeName}</div>
      <div class="brand-tagline">Gift Voucher</div>
    </div>

    <div class="body">
      <div class="title">Gift Voucher</div>

      ${voucher.recipient_name ? `<div class="recipient">A gift for <strong>${voucher.recipient_name}</strong></div>` : ''}

      <div class="value-box">
        <div class="value">${voucherValue}</div>
        <div class="value-subtext">${voucherSubtext}</div>
      </div>

      <hr class="dashed-divider" />

      <div class="qr-section">
        <div class="qr-code">
          <img src="${qrDataUrl}" width="130" height="130" alt="QR Code" />
        </div>
        <div class="code-label">Voucher Code</div>
        <div class="code">${voucher.code}</div>
      </div>

      ${voucher.message ? `<div class="message">&ldquo;${voucher.message}&rdquo;</div>` : ''}

      <div class="terms">
        <hr class="terms-divider" />
        <div class="terms-list">
          <p>This voucher is valid for redemption at ${storeName} only.</p>
          <p>Present this voucher or quote the code above at the time of purchase.</p>
          <p>Cannot be exchanged for cash. No change will be given for partial redemption.</p>
          <p>Lost or stolen vouchers cannot be replaced.</p>
        </div>
      </div>
    </div>

    <div class="footer">
      <div class="expiry">Valid until: ${expiryText}</div>
      ${storeAddress ? `<div class="address">${storeAddress}</div>` : ''}
      <div class="issued">Issued: ${createdDate}</div>
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
