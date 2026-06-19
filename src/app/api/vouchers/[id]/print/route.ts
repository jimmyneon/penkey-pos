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
    color: { dark: '#1a1a1a', light: '#ffffff' },
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Gift Voucher \u2013 ${voucher.code}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      height: 100%;
      font-family: 'Inter', Arial, sans-serif;
      background: #f5f5f0;
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
      max-width: 420px;
      background: #fff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15);
      page-break-inside: avoid;
      position: relative;
    }

    .header {
      background: linear-gradient(135deg, #e97c2c 0%, #d45f10 100%);
      padding: 40px 30px 30px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: '';
      position: absolute;
      top: -60px; right: -60px;
      width: 200px; height: 200px;
      border-radius: 50%;
      background: rgba(255,255,255,0.1);
    }
    .header::after {
      content: '';
      position: absolute;
      bottom: -40px; left: -40px;
      width: 150px; height: 150px;
      border-radius: 50%;
      background: rgba(255,255,255,0.08);
    }
    .logo {
      max-height: 60px;
      width: auto;
      object-fit: contain;
      margin-bottom: 12px;
      position: relative;
      z-index: 1;
    }
    .gift-label {
      font-size: 12px;
      font-weight: 600;
      color: rgba(255,255,255,0.9);
      text-transform: uppercase;
      letter-spacing: 4px;
      position: relative;
      z-index: 1;
    }

    .wave {
      display: block;
      width: 100%;
      background: #e97c2c;
    }
    .wave svg { display: block; }

    .body {
      padding: 32px 30px 24px;
      text-align: center;
    }

    .recipient-name {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 24px;
      color: #2a1a0a;
      margin-bottom: 20px;
      font-weight: 700;
    }

    .value-wrap {
      background: linear-gradient(135deg, #fff8f3, #ffeedd);
      border: 2px solid #e97c2c;
      border-radius: 16px;
      padding: 20px 32px;
      margin-bottom: 24px;
    }
    .value-label { font-size: 11px; color: #b08060; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px; }
    .value { font-family: 'Playfair Display', Georgia, serif; font-size: 48px; font-weight: 900; color: #e97c2c; line-height: 1; }

    .dots {
      display: flex; align-items: center; gap: 8px; justify-content: center; margin: 20px 0;
    }
    .dots span { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #e2c9b8; }
    .dots span.big { width: 8px; height: 8px; background: #e97c2c; }

    .qr-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 24px;
      margin-bottom: 24px;
    }
    .qr-box {
      background: #fff;
      border: 2px solid #f0e0d0;
      border-radius: 16px;
      padding: 12px;
      flex-shrink: 0;
    }
    .qr-box img { display: block; border-radius: 10px; }
    .code-box { text-align: left; }
    .code-label { font-size: 10px; color: #b08060; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px; }
    .code {
      font-family: 'Courier New', monospace;
      font-size: 18px;
      font-weight: 700;
      color: #2a1a0a;
      letter-spacing: 3px;
      background: #f9f3ee;
      border: 1.5px dashed #e0c0a0;
      border-radius: 10px;
      padding: 10px 16px;
      display: inline-block;
    }
    .scan-hint { font-size: 11px; color: #888; margin-top: 8px; }

    .message-wrap {
      background: #fffaf6;
      border-left: 3px solid #e97c2c;
      border-radius: 0 10px 10px 0;
      padding: 14px 18px;
      margin-bottom: 20px;
      text-align: left;
    }
    .message { font-size: 14px; color: #666; font-style: italic; line-height: 1.6; }

    .footer {
      background: #fdf8f4;
      border-top: 1px dashed #e8d5c4;
      padding: 20px 30px;
      text-align: center;
    }
    .expiry-label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #c0a080; }
    .expiry-date { font-size: 14px; font-weight: 600; color: #5a3a1a; margin-top: 4px; }
    .store-address { font-size: 12px; color: #888; margin-top: 8px; }

    .print-btn-wrap { margin-top: 24px; text-align: center; }
    .print-btn {
      background: linear-gradient(135deg, #e97c2c, #d45f10);
      color: white;
      border: none;
      padding: 14px 40px;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      box-shadow: 0 4px 16px rgba(233,124,44,0.35);
      letter-spacing: 0.5px;
    }
    .print-btn:hover { opacity: 0.9; }

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
      }
      .print-btn-wrap { display: none !important; }
      @page { margin: 0; size: A5 portrait; }
    }
  </style>
</head>
<body>
  <div class="voucher">
    <div class="header">
      <img src="/penkey-logo.png" alt="${storeName}" class="logo" onerror="this.style.display='none'" />
      <div class="gift-label">&#10022; Gift Voucher &#10022;</div>
    </div>
    <div class="wave">
      <svg viewBox="0 0 420 20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" height="20">
        <path d="M0,10 C60,20 120,0 180,10 C240,20 300,0 360,10 C420,20 460,4 480,10 L480,0 L0,0 Z" fill="#e97c2c"/>
        <path d="M0,10 C60,20 120,0 180,10 C240,20 300,0 360,10 C420,20 460,4 480,10 L480,20 L0,20 Z" fill="#ffffff"/>
      </svg>
    </div>

    <div class="body">
      ${voucher.recipient_name ? `<div class="recipient-name">For ${voucher.recipient_name}</div>` : ''}

      <div class="value-wrap">
        <div class="value-label">Voucher Value</div>
        <div class="value">${voucherValue}</div>
      </div>

      <div class="dots">
        <span></span><span></span><span class="big"></span><span></span><span></span>
      </div>

      <div class="qr-row">
        <div class="qr-box">
          <img src="${qrDataUrl}" width="130" height="130" alt="QR Code" />
        </div>
        <div class="code-box">
          <div class="code-label">Your Code</div>
          <div class="code">${voucher.code}</div>
          <div class="scan-hint">Scan QR or quote code<br>when redeeming in-store</div>
        </div>
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
    <button class="print-btn" onclick="window.print()">&#128438; Print &nbsp;/&nbsp; Save as PDF</button>
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
