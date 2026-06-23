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
  return `Free ${v.item_name || 'item'}`;
}

function expiryText(v: any): string {
  if (!v.expires_at) return 'No expiry';
  return new Date(v.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function buildVoucherPage(v: any, qrDataUrl: string, storeAddress?: string): string {
  const valueText = escapeHtml(getValueText(v));
  const expiry = escapeHtml(expiryText(v));
  const created = escapeHtml(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
  const recipient = v.recipient_name ? escapeHtml(v.recipient_name) : '';
  const message = v.message ? escapeHtml(v.message) : '';
  const code = escapeHtml(v.code);
  const storeAddrEsc = storeAddress ? escapeHtml(storeAddress) : '';

  const recipientBlock = recipient ? `
    <div class="overlay-text" style="top: 27%;">
      <div class="label-text">A gift for</div>
      <div class="recipient-name">${recipient}</div>
    </div>` : '';

  const messageBlock = message ? `
    <div class="overlay-text" style="top: 67%;">
      <div class="message-text">&ldquo;${message}&rdquo;</div>
    </div>` : '';

  return `<div class="voucher-page">
    <div class="voucher-container">
      ${recipientBlock}
      <div class="overlay-text" style="top: 35%;">
        <div class="value-text">${valueText}</div>
      </div>
      <div class="qr-wrapper">
        <img src="${qrDataUrl}" alt="QR Code" />
      </div>
      <div class="overlay-text" style="top: 62%;">
        <div class="code-label">VOUCHER CODE</div>
        <div class="code-text">${code}</div>
      </div>
      ${messageBlock}
      <div class="overlay-text" style="top: 83%;">
        <div class="expiry-text">Valid until: ${expiry}</div>
        ${storeAddrEsc ? `<div class="store-addr">${storeAddrEsc}</div>` : ''}
        <div class="issued-text">Issued: ${created}</div>
      </div>
    </div>
  </div>`;
}

function buildBatchPrintHtml(pages: string[], count: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Print Batch Vouchers (${count})</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      background: #e8e4dc;
    }
    body { display: flex; flex-direction: column; align-items: center; padding: 24px; }
    .voucher-page {
      margin-bottom: 24px;
      page-break-after: always;
      break-after: page;
    }
    .voucher-page:last-child { page-break-after: avoid; break-after: avoid; }
    .voucher-container {
      position: relative;
      width: 105mm;
      max-width: 100%;
      aspect-ratio: 535 / 1536;
      background-image: url('/voucher.png');
      background-size: 100% 100%;
      background-position: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      border-radius: 4px;
      overflow: hidden;
    }
    .overlay-text { position: absolute; left: 0; right: 0; text-align: center; padding: 0 8%; }
    .label-text { font-size: 11px; color: rgba(245,235,214,0.6); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
    .recipient-name { font-size: 16px; font-weight: 700; color: #fff; }
    .value-text { font-size: 36px; font-weight: 800; color: #c9a96e; line-height: 1; }
    .qr-wrapper { position: absolute; top: 44%; left: 50%; transform: translateX(-50%); background: #fff; padding: 6px; border-radius: 8px; }
    .qr-wrapper img { display: block; width: 140px; height: 140px; }
    .code-label { font-size: 10px; color: rgba(245,235,214,0.6); text-transform: uppercase; letter-spacing: 3px; }
    .code-text { font-family: 'Courier New', monospace; font-size: 14px; font-weight: 700; color: #fff; letter-spacing: 3px; margin-top: 4px; }
    .message-text { font-size: 13px; font-style: italic; color: #fff; line-height: 1.4; }
    .expiry-text { font-size: 13px; font-weight: 700; color: #f5ebd6; }
    .store-addr { font-size: 10px; color: #f5ebd6; opacity: 0.7; margin-top: 4px; }
    .issued-text { font-size: 9px; color: #f5ebd6; opacity: 0.5; margin-top: 4px; }
    .print-btn-wrap { margin-top: 24px; text-align: center; }
    .print-btn { background: #1a2847; color: white; border: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; box-shadow: 0 2px 8px rgba(26,40,71,0.3); }
    .print-btn:hover { background: #243556; }
    .loading-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 999; }
    .loading-overlay.hidden { display: none; }
    .spinner { width: 48px; height: 48px; border: 4px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media print {
      html, body { background: white; padding: 0; margin: 0; min-height: 0; overflow: hidden; display: block !important; }
      .voucher-page { margin: 0; page-break-after: always; break-after: page; }
      .voucher-page:last-child { page-break-after: avoid; break-after: avoid; }
      .voucher-container { width: auto; max-width: 100%; max-height: 297mm; height: auto; box-shadow: none; border-radius: 0; }
      .print-btn-wrap, .loading-overlay { display: none !important; }
      @page { margin: 0; size: A4; }
    }
  </style>
</head>
<body>
  <div class="loading-overlay" id="loadingOverlay"><div class="spinner"></div></div>
  ${pages.join('\n')}
  <div class="print-btn-wrap">
    <button class="print-btn" onclick="window.print()">Print All (${count})</button>
  </div>
  <script>
    function hideLoading() { document.getElementById('loadingOverlay').classList.add('hidden'); }
    var img = new Image(); img.onload = hideLoading; img.onerror = hideLoading; img.src = '/voucher.png';
    setTimeout(hideLoading, 5000);
    if (new URLSearchParams(window.location.search).get('autoprint') === '1') {
      window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 1000); });
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

  const { data: voucher } = await supabase
    .from('gift_vouchers')
    .select('*')
    .eq('id', params.id)
    .eq('org_id', session.org_id)
    .single();

  if (!voucher) return new NextResponse('Voucher not found', { status: 404 });

  const batchId = (voucher as any).batch_id;
  if (!batchId) {
    return new NextResponse('Not a batch voucher', { status: 400 });
  }

  const { data: batchVouchers } = await supabase
    .from('gift_vouchers')
    .select('*')
    .eq('org_id', session.org_id)
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true });

  if (!batchVouchers || batchVouchers.length === 0) {
    return new NextResponse('No vouchers in batch', { status: 404 });
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

  const pages: string[] = [];
  for (const v of batchVouchers) {
    const vv = v as any;
    try {
      const qrDataUrl = await QRCode.toDataURL(vv.code, {
        width: 300,
        margin: 1,
        color: { dark: '#1a2847', light: '#ffffff' },
      });
      pages.push(buildVoucherPage(vv, qrDataUrl, storeAddress));
    } catch (err) {
      console.error(`[Batch Print] Failed for ${vv.code}:`, err);
    }
  }

  if (pages.length === 0) {
    return new NextResponse('Failed to generate voucher pages', { status: 500 });
  }

  const html = buildBatchPrintHtml(pages, pages.length);
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
