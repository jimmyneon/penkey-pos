export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';
import { generateVoucherPng } from '@/lib/voucher/voucher-template';

function buildBatchPrintHtml(images: { code: string; base64: string }[]): string {
  const pages = images.map(({ code, base64 }) =>
    `<div class="voucher-page">
      <img class="voucher-img" src="data:image/png;base64,${base64}" alt="Voucher ${code}" />
    </div>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Print Batch Vouchers</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #e8e4dc;
    }
    body { display: flex; flex-direction: column; align-items: center; padding: 24px; }
    .voucher-page {
      margin-bottom: 24px;
      page-break-after: always;
      break-after: page;
    }
    .voucher-page:last-child { page-break-after: avoid; break-after: avoid; }
    .voucher-img {
      width: 105mm;
      max-width: 100%;
      height: auto;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      border-radius: 4px;
    }
    .print-btn-wrap { margin-top: 24px; text-align: center; }
    .print-btn {
      background: #1a2847; color: white; border: none;
      padding: 12px 32px; border-radius: 8px; font-size: 14px;
      font-weight: 600; cursor: pointer; font-family: inherit;
      box-shadow: 0 2px 8px rgba(26,40,71,0.3);
    }
    .print-btn:hover { background: #243556; }
    @media print {
      html, body { background: white; padding: 0; margin: 0; overflow: hidden; }
      .voucher-page { margin: 0; }
      .voucher-img {
        box-shadow: none; border-radius: 0;
        width: auto; max-width: none;
        height: 297mm; object-fit: contain;
      }
      .print-btn-wrap { display: none !important; }
      @page { margin: 0; size: A4; }
    }
  </style>
</head>
<body>
  ${pages}
  <div class="print-btn-wrap">
    <button class="print-btn" onclick="window.print()">Print All (${images.length})</button>
  </div>
  <script>
    if (new URLSearchParams(window.location.search).get('autoprint') === '1') {
      window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 600); });
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

  const images: { code: string; base64: string }[] = [];
  for (const v of batchVouchers) {
    const vv = v as any;
    try {
      const pngBuffer = await generateVoucherPng({
        code: vv.code,
        voucher_type: vv.voucher_type,
        amount: vv.amount,
        percent_discount: vv.percent_discount,
        item_name: vv.item_name,
        recipient_name: vv.recipient_name,
        recipient_email: vv.recipient_email,
        message: vv.message,
        expires_at: vv.expires_at,
        storeName,
        storeAddress,
      });
      images.push({ code: vv.code, base64: pngBuffer.toString('base64') });
    } catch (err) {
      console.error(`[Batch Print] Failed for ${vv.code}:`, err);
    }
  }

  if (images.length === 0) {
    return new NextResponse('Failed to generate voucher images', { status: 500 });
  }

  const html = buildBatchPrintHtml(images);
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
