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
    color: { dark: '#1a2847', light: '#ffffff' },
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
      font-family: Georgia, serif;
      background: #e8e4dc;
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
      background: #1a2847;
      padding: 4mm;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      page-break-inside: avoid;
      display: flex;
      flex-direction: column;
      border-radius: 6px;
      position: relative;
      overflow: hidden;
    }

    /* Navy top section */
    .header-band {
      background: linear-gradient(135deg, #1a2847 0%, #243556 100%);
      padding: 20mm 12mm 16mm;
      text-align: center;
      border-radius: 4px;
      position: relative;
      flex-shrink: 0;
    }
    .header-band::before {
      content: '';
      position: absolute;
      top: 4mm;
      left: 8mm;
      right: 8mm;
      height: 1px;
      background: linear-gradient(90deg, transparent, #c9a96e, transparent);
    }
    .header-band::after {
      content: '';
      position: absolute;
      bottom: 4mm;
      left: 8mm;
      right: 8mm;
      height: 1px;
      background: linear-gradient(90deg, transparent, #c9a96e, transparent);
    }
    .brand-name {
      font-size: 24px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 2px;
      font-family: Georgia, serif;
    }
    .gold-divider {
      width: 40px;
      height: 2px;
      background: #c9a96e;
      margin: 8px auto;
    }
    .brand-tagline {
      font-size: 10px;
      color: #c9a96e;
      text-transform: uppercase;
      letter-spacing: 6px;
      font-family: Arial, sans-serif;
      font-weight: 600;
    }
    .recipient-wrap {
      margin-top: 16px;
    }
    .recipient-label {
      font-size: 12px;
      color: #f5ebd6;
      opacity: 0.7;
      font-family: Georgia, serif;
    }
    .recipient-name {
      font-size: 20px;
      color: #ffffff;
      font-weight: 600;
      font-family: Georgia, serif;
      margin-top: 4px;
    }
    .value {
      font-size: ${voucherValue.length > 10 ? '40px' : '56px'};
      font-weight: 700;
      color: #c9a96e;
      font-family: Georgia, serif;
      line-height: 1;
      margin-top: ${voucher.recipient_name ? '12px' : '24px'};
    }

    /* Cream middle section */
    .body {
      background: #f5ebd6;
      padding: 16mm 12mm;
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
    }

    .value-subtext {
      font-size: 11px;
      color: #8a8a8a;
      margin-top: 0;
      margin-bottom: 16px;
      line-height: 1.5;
      max-width: 260px;
      text-align: center;
      font-family: Arial, sans-serif;
    }

    .dashed-divider {
      border: none;
      border-top: 2px dashed #e8dcc0;
      width: calc(100% - 20mm);
      margin: 0 0 16px;
    }

    .qr-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }
    .qr-code {
      background: #fff;
      padding: 6px;
      border: 1px solid #e8dcc0;
      border-radius: 10px;
    }
    .code-label {
      font-size: 9px;
      color: #8a8a8a;
      text-transform: uppercase;
      letter-spacing: 3px;
      font-family: Arial, sans-serif;
    }
    .code {
      font-family: 'Courier New', monospace;
      font-size: 22px;
      font-weight: 700;
      color: #1a2847;
      letter-spacing: 4px;
    }

    .message {
      text-align: center;
      font-size: 13px;
      color: #2a2a2a;
      font-style: italic;
      margin-bottom: 16px;
      line-height: 1.6;
      padding: 0 10px;
      font-family: Georgia, serif;
    }

    .terms {
      margin-top: auto;
      width: 100%;
    }
    .terms-divider {
      border: none;
      border-top: 1px solid #e8dcc0;
      margin-bottom: 12px;
    }
    .terms-list {
      font-size: 9px;
      color: #8a8a8a;
      line-height: 1.7;
      padding: 0 5px;
      font-family: Arial, sans-serif;
    }
    .terms-list p { margin-bottom: 3px; }

    /* Navy bottom section */
    .footer {
      text-align: center;
      padding: 12mm 12mm 16mm;
      background: linear-gradient(135deg, #243556 0%, #1a2847 100%);
      border-radius: 4px;
      position: relative;
      flex-shrink: 0;
    }
    .footer::before {
      content: '';
      position: absolute;
      top: 4mm;
      left: 8mm;
      right: 8mm;
      height: 1px;
      background: linear-gradient(90deg, transparent, #c9a96e, transparent);
      opacity: 0.5;
    }
    .footer-flourish {
      width: 40px;
      height: 1px;
      background: #c9a96e;
      opacity: 0.5;
      margin: 0 auto 12px;
    }
    .expiry { margin-bottom: 4px; font-weight: 600; color: #ffffff; font-size: 13px; font-family: Arial, sans-serif; }
    .address { font-size: 11px; color: #f5ebd6; opacity: 0.6; font-family: Arial, sans-serif; }
    .scan-text { font-size: 10px; color: #f5ebd6; opacity: 0.4; margin-top: 8px; font-family: Arial, sans-serif; }
    .issued { font-size: 9px; color: #f5ebd6; opacity: 0.3; margin-top: 4px; font-family: Arial, sans-serif; }

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
        border-radius: 0;
      }
      .print-btn-wrap { display: none !important; }
      @page { margin: 0; size: 105mm 297mm; }
    }
  </style>
</head>
<body>
  <div class="voucher">
    <div class="header-band">
      <div class="brand-name">${storeName}</div>
      <div class="gold-divider"></div>
      <div class="brand-tagline">Gift Voucher</div>
      ${voucher.recipient_name ? `
      <div class="recipient-wrap">
        <div class="recipient-label">A gift for</div>
        <div class="recipient-name">${voucher.recipient_name}</div>
      </div>
      ` : ''}
      <div class="value">${voucherValue}</div>
    </div>

    <div class="body">
      <div class="value-subtext">${voucherSubtext}</div>

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
      <div class="footer-flourish"></div>
      <div class="expiry">Valid until: ${expiryText}</div>
      ${storeAddress ? `<div class="address">${storeAddress}</div>` : ''}
      <div class="scan-text">Scan the QR code or present this code in-store to redeem</div>
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
