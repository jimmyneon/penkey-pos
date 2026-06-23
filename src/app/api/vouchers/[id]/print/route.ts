export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';
import QRCode from 'qrcode';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getValueText(v: any): string {
  if (v.voucher_type === 'amount') return `\u00a3${Number(v.amount).toFixed(2)}`;
  if (v.voucher_type === 'percent') return `${v.percent_discount}% OFF`;
  if (v.voucher_title) return v.voucher_title;
  return `Free ${v.item_name || 'item'}`;
}

function expiryText(v: any): string {
  if (!v.expires_at) return 'No expiry';
  return new Date(v.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function buildPrintPageHtml(v: any, qrDataUrl: string, storeName: string, storeAddress?: string): string {
  const valueText = escapeHtml(getValueText(v));
  const expiry = escapeHtml(expiryText(v));
  const created = escapeHtml(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
  const recipient = v.recipient_name ? escapeHtml(v.recipient_name) : '';
  const message = v.message ? escapeHtml(v.message) : '';
  const code = escapeHtml(v.code);
  const storeAddrEsc = storeAddress ? escapeHtml(storeAddress) : '';

  const recipientBlock = (recipient && v.voucher_type !== 'item') ? `
    <div class="overlay-text" style="top: 17%;">
      <div class="recipient-name">For ${recipient}</div>
    </div>` : '';

  const messageBlock = message ? `
    <div class="overlay-text" style="top: 48%;">
      <div class="message-text">&ldquo;${message}&rdquo;</div>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Print Voucher - ${code}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      background: #e8e4dc;
    }
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px;
      min-height: 100vh;
    }
    .voucher-container {
      position: relative;
      width: 105mm;
      max-width: 100%;
      aspect-ratio: 535 / 1536;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      border-radius: 4px;
      overflow: hidden;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .voucher-bg {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      object-fit: cover;
      z-index: 0;
    }
    .overlay-text {
      position: absolute;
      left: 0;
      right: 0;
      text-align: center;
      padding: 0 8%;
      z-index: 1;
    }
    .recipient-name {
      font-size: 18px;
      font-weight: 600;
      color: #f5ebd6;
      letter-spacing: 1px;
    }
    .value-text {
      font-size: 54px;
      font-weight: 800;
      color: #c9a96e;
      line-height: 1;
    }
    .qr-wrapper {
      position: absolute;
      top: 34%;
      left: 50%;
      transform: translateX(-50%);
      background: #fff;
      padding: 8px;
      border-radius: 10px;
      z-index: 1;
    }
    .qr-wrapper img {
      display: block;
      width: 210px;
      height: 210px;
    }
    .code-text {
      font-family: 'Poppins', 'Courier New', monospace;
      font-size: 18px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 4px;
    }
    .message-text {
      font-size: 14px;
      font-style: italic;
      color: #ffffff;
      line-height: 1.4;
    }
    .expiry-text {
      font-size: 14px;
      font-weight: 600;
      color: #f5ebd6;
    }
    .store-addr {
      font-size: 10px;
      color: #f5ebd6;
      opacity: 0.7;
      margin-top: 4px;
    }
    .issued-text {
      font-size: 9px;
      color: #f5ebd6;
      opacity: 0.5;
      margin-top: 4px;
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
    .loading-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
      z-index: 999;
    }
    .loading-overlay.hidden { display: none; }
    .spinner {
      width: 48px; height: 48px;
      border: 4px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media print {
      html, body {
        background: white; padding: 0; margin: 0;
        min-height: 0; max-height: 297mm;
        overflow: hidden;
        display: flex !important;
        align-items: center; justify-content: center;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .voucher-container {
        width: 105mm; max-width: 100%;
        max-height: 297mm; height: auto;
        box-shadow: none; border-radius: 0;
        page-break-after: avoid; break-after: avoid;
        margin: 0 auto;
      }
      .voucher-bg { width: 100%; height: 100%; }
      .print-btn-wrap, .loading-overlay { display: none !important; }
      @page { margin: 0; size: A4; }
    }
  </style>
</head>
<body>
  <div class="loading-overlay" id="loadingOverlay">
    <div class="spinner"></div>
  </div>
  <div class="voucher-container">
    <img class="voucher-bg" src="/voucher.png" alt="Voucher" />
    ${recipientBlock}
    <div class="overlay-text" style="top: 25%;">
      <div class="value-text">${valueText}</div>
    </div>
    <div class="qr-wrapper">
      <img src="${qrDataUrl}" alt="QR Code" />
    </div>
    ${messageBlock}
    <div class="overlay-text" style="top: 56%;">
      <div class="expiry-text">Valid until: ${expiry}</div>
    </div>
    <div class="overlay-text" style="top: 60%;">
      <div class="code-text">${code}</div>
    </div>
  </div>
  <div class="print-btn-wrap">
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <script>
    function hideLoading() {
      document.getElementById('loadingOverlay').classList.add('hidden');
    }
    var img = new Image();
    img.onload = hideLoading;
    img.onerror = hideLoading;
    img.src = '/voucher.png';
    setTimeout(hideLoading, 5000);
    if (new URLSearchParams(window.location.search).get('autoprint') === '1') {
      window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 800); });
    }
  </script>
</body>
</html>`;
}

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

  const qrDataUrl = await QRCode.toDataURL(v.code, {
    width: 300,
    margin: 1,
    color: { dark: '#1a2847', light: '#ffffff' },
  });

  const html = buildPrintPageHtml(v, qrDataUrl, storeName, storeAddress);
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return GET(request, { params });
}
