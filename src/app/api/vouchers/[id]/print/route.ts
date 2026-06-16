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
      background: #f7f3ef;
    }
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      min-height: 100vh;
    }

    /* ── voucher card ── */
    .voucher {
      width: 100%;
      max-width: 480px;
      background: #fff;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 12px 48px rgba(0,0,0,0.14);
      page-break-inside: avoid;
    }

    /* ── header band ── */
    .header {
      background: linear-gradient(135deg, #e97c2c 0%, #d45f10 100%);
      padding: 32px 28px 28px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: '';
      position: absolute;
      top: -40px; right: -40px;
      width: 160px; height: 160px;
      border-radius: 50%;
      background: rgba(255,255,255,0.08);
    }
    .header::after {
      content: '';
      position: absolute;
      bottom: -50px; left: -30px;
      width: 140px; height: 140px;
      border-radius: 50%;
      background: rgba(255,255,255,0.06);
    }
    .brand {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 34px;
      font-weight: 900;
      color: #fff;
      letter-spacing: 2px;
      position: relative;
      z-index: 1;
    }
    .gift-label {
      display: inline-block;
      margin-top: 6px;
      font-size: 11px;
      font-weight: 600;
      color: rgba(255,255,255,0.85);
      text-transform: uppercase;
      letter-spacing: 4px;
      position: relative;
      z-index: 1;
    }

    /* ── wavy divider ── */
    .wave { display: block; width: 100%; background: #e97c2c; }
    .wave svg { display: block; }

    /* ── body ── */
    .body {
      padding: 28px 28px 20px;
      text-align: center;
    }
    .to-label {
      font-size: 13px;
      color: #b08060;
      font-style: italic;
      margin-bottom: 4px;
    }
    .recipient-name {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 22px;
      color: #2a1a0a;
      margin-bottom: 18px;
    }

    /* ── value badge ── */
    .value-wrap {
      margin: 0 auto 20px;
      display: inline-block;
      background: linear-gradient(135deg, #fff8f3, #ffeedd);
      border: 2px solid #e97c2c;
      border-radius: 16px;
      padding: 14px 32px;
    }
    .value-label { font-size: 10px; color: #b08060; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
    .value { font-family: 'Playfair Display', Georgia, serif; font-size: 52px; font-weight: 900; color: #e97c2c; line-height: 1; }
    .value-sub { font-size: 13px; color: #888; margin-top: 4px; }

    /* ── divider dots ── */
    .dots {
      display: flex; align-items: center; gap: 6px; justify-content: center; margin: 18px 0;
    }
    .dots span { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #e2c9b8; }
    .dots span.big { width: 7px; height: 7px; background: #e97c2c; }

    /* ── QR + code row ── */
    .qr-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 20px;
      margin-bottom: 20px;
    }
    .qr-box {
      background: #fff;
      border: 2px solid #f0e0d0;
      border-radius: 14px;
      padding: 10px;
      flex-shrink: 0;
    }
    .qr-box img { display: block; border-radius: 6px; }
    .code-box { text-align: left; }
    .code-label { font-size: 10px; color: #b08060; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px; }
    .code {
      font-family: 'Courier New', monospace;
      font-size: 20px;
      font-weight: 700;
      color: #2a1a0a;
      letter-spacing: 3px;
      background: #f9f3ee;
      border: 1.5px dashed #e0c0a0;
      border-radius: 8px;
      padding: 8px 14px;
      display: inline-block;
    }
    .scan-hint { font-size: 11px; color: #aaa; margin-top: 6px; }

    /* ── message ── */
    .message-wrap {
      background: #fffaf6;
      border-left: 3px solid #e97c2c;
      border-radius: 0 8px 8px 0;
      padding: 10px 14px;
      margin: 0 0 20px;
      text-align: left;
    }
    .message { font-size: 13px; color: #666; font-style: italic; line-height: 1.5; }

    /* ── footer ── */
    .footer {
      background: #fdf8f4;
      border-top: 1px dashed #e8d5c4;
      padding: 16px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .expiry-wrap { text-align: left; }
    .expiry-label { font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #c0a080; }
    .expiry-date { font-size: 13px; font-weight: 600; color: #5a3a1a; margin-top: 2px; }
    .redeem-hint { font-size: 11px; color: #aaa; text-align: right; max-width: 160px; line-height: 1.4; }

    /* ── print button (hidden on print) ── */
    .print-btn-wrap { margin-top: 20px; text-align: center; }
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
      @page { margin: 0.5cm; size: A5 portrait; }
    }
  </style>
</head>
<body>
  <div class="voucher">
    <div class="header">
      <img src="/penkey-logo.png" alt="${storeName}" style="height:48px;width:auto;object-fit:contain;margin-bottom:8px;position:relative;z-index:1;" onerror="this.style.display='none'" />
      <div class="brand">${storeName}</div>
      <div class="gift-label">&#10022; Gift Voucher &#10022;</div>
    </div>
    <!-- wavy edge using inline SVG -->
    <div class="wave">
      <svg viewBox="0 0 480 20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" height="20">
        <path d="M0,10 C60,20 120,0 180,10 C240,20 300,0 360,10 C420,20 460,4 480,10 L480,0 L0,0 Z" fill="#e97c2c"/>
        <path d="M0,10 C60,20 120,0 180,10 C240,20 300,0 360,10 C420,20 460,4 480,10 L480,20 L0,20 Z" fill="#ffffff"/>
      </svg>
    </div>

    <div class="body">
      ${voucher.recipient_name ? `<div class="to-label">This voucher is for</div><div class="recipient-name">${voucher.recipient_name}</div>` : ''}

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
      <div class="expiry-wrap">
        <div class="expiry-label">Valid Until</div>
        <div class="expiry-date">${expiryText}</div>
        ${storeAddress ? `<div style="font-size:10px;color:#bbb;margin-top:4px;">${storeAddress}</div>` : ''}
      </div>
      <div class="redeem-hint">Present in-store or online to redeem your gift</div>
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
