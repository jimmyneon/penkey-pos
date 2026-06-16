export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';
import QRCode from 'qrcode';

async function buildVoucherHtml(voucher: any, storeName: string): Promise<string> {
  const voucherValue =
    voucher.voucher_type === 'amount' ? `\u00a3${Number(voucher.amount).toFixed(2)}`
    : voucher.voucher_type === 'percent' ? `${voucher.percent_discount}% OFF`
    : `FREE: ${voucher.item_name}`;

  const expiryText = voucher.expires_at
    ? `Valid until: ${new Date(voucher.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : 'No expiry date';

  const qrDataUrl = await QRCode.toDataURL(voucher.code, {
    width: 240,
    margin: 2,
    color: { dark: '#1a1a1a', light: '#ffffff' },
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Gift Voucher – ${voucher.code}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f0f0f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .voucher { background: white; border-radius: 20px; overflow: hidden; width: 100%; max-width: 420px; box-shadow: 0 8px 40px rgba(0,0,0,0.15); }
    .header { background: #e97c2c; padding: 28px 24px; text-align: center; }
    .header .brand { font-size: 30px; font-weight: 900; color: white; letter-spacing: -1px; }
    .header .subtitle { font-size: 12px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 3px; margin-top: 4px; }
    .body { padding: 28px 24px; text-align: center; }
    .recipient { font-size: 14px; color: #888; margin-bottom: 6px; }
    .value { font-size: 52px; font-weight: 900; color: #e97c2c; line-height: 1; }
    .qr-wrap { margin: 20px auto; display: inline-block; background: #f9f9f9; border-radius: 14px; padding: 14px; }
    .qr-wrap img { display: block; }
    .code-box { background: #f9f9f9; border-radius: 12px; padding: 14px 20px; margin-top: 4px; }
    .code-label { font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px; }
    .code { font-size: 24px; font-weight: 700; color: #1a1a1a; letter-spacing: 5px; }
    .personal-msg { font-size: 14px; color: #666; font-style: italic; margin-top: 16px; }
    .footer { background: #fafafa; padding: 18px 24px; text-align: center; border-top: 1px solid #eee; }
    .expiry { font-size: 13px; color: #888; }
    .redeem { font-size: 12px; color: #aaa; margin-top: 6px; }
    .store { font-size: 11px; color: #ccc; margin-top: 10px; }
    @media print {
      body { background: white; padding: 0; }
      .voucher { box-shadow: none; border-radius: 0; max-width: 100%; }
      .print-btn { display: none !important; }
    }
  </style>
</head>
<body>
  <div>
    <div class="voucher">
      <div class="header">
        <div class="brand">${storeName.toUpperCase()}</div>
        <div class="subtitle">Gift Voucher</div>
      </div>
      <div class="body">
        ${voucher.recipient_name ? `<div class="recipient">For ${voucher.recipient_name}</div>` : ''}
        <div class="value">${voucherValue}</div>
        <div class="qr-wrap">
          <img src="${qrDataUrl}" width="180" height="180" alt="QR Code" />
        </div>
        <div class="code-box">
          <div class="code-label">Voucher Code</div>
          <div class="code">${voucher.code}</div>
        </div>
        ${voucher.message ? `<div class="personal-msg">"${voucher.message}"</div>` : ''}
      </div>
      <div class="footer">
        <div class="expiry">${expiryText}</div>
        <div class="redeem">Scan the QR code or present this voucher in-store to redeem.</div>
        <div class="store">${storeName} &middot; Lymington</div>
      </div>
    </div>
    <div style="text-align:center;margin-top:16px;">
      <button class="print-btn" onclick="window.print()" style="background:#e97c2c;color:white;border:none;padding:12px 32px;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;">
        Print / Save as PDF
      </button>
    </div>
  </div>
  <script>
    // Auto-trigger print dialog if opened from POS
    if (window.opener || new URLSearchParams(window.location.search).get('autoprint') === '1') {
      window.onload = () => setTimeout(() => window.print(), 400);
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

  let storeName = 'Penkey Delicaf\u00e9 & Gifts';
  try {
    const { data: template } = await supabase
      .from('print_templates')
      .select('template')
      .eq('org_id', session.org_id)
      .eq('type', 'receipt')
      .eq('is_default', true)
      .maybeSingle();
    if (template?.template) storeName = template.template.split('\n')[0] || storeName;
  } catch {}

  const html = await buildVoucherHtml(voucher as any, storeName);
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// POST – same HTML but also sends to ESC/POS receipt printer if one is online
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return GET(request, { params });
}
