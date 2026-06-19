export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/database';
import { validatePOSSession, unauthorizedResponse } from '@/lib/api/auth';

function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'PNK-';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function GET(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('gift_vouchers')
    .select('*')
    .eq('org_id', session.org_id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vouchers: data });
}

export async function POST(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await request.json();
  const {
    voucher_type,
    amount,
    percent_discount,
    item_id,
    item_name,
    recipient_name,
    recipient_email,
    expires_at,
    message,
    send_email,
  } = body;

  const validTypes = ['amount', 'item', 'percent'];
  if (!validTypes.includes(voucher_type)) {
    return NextResponse.json({ error: 'Invalid voucher_type' }, { status: 400 });
  }

  // Generate unique code
  let code = generateVoucherCode();
  let attempts = 0;
  while (attempts < 5) {
    const { data: existing } = await supabase
      .from('gift_vouchers')
      .select('id')
      .eq('org_id', session.org_id)
      .eq('code', code)
      .maybeSingle();
    if (!existing) break;
    code = generateVoucherCode();
    attempts++;
  }

  const qrData = JSON.stringify({ type: 'voucher', code, org_id: session.org_id });

  const { data: voucher, error } = await supabase
    .from('gift_vouchers')
    .insert({
      org_id: session.org_id,
      code,
      qr_data: qrData,
      voucher_type,
      amount: voucher_type === 'amount' ? amount : null,
      percent_discount: voucher_type === 'percent' ? percent_discount : null,
      item_id: voucher_type === 'item' ? item_id : null,
      item_name: voucher_type === 'item' ? item_name : null,
      recipient_name: recipient_name || null,
      recipient_email: recipient_email || null,
      expires_at: expires_at || null,
      message: message || null,
      issued_by: session.user_id,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    console.error('[Voucher POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send email if requested
  if (send_email && recipient_email && voucher) {
    console.log('[Voucher POST] Sending email to:', recipient_email);
    try {
      await sendVoucherEmail(voucher as any);
      console.log('[Voucher POST] Email sent successfully');
    } catch (emailErr) {
      console.error('[Voucher POST] Email failed:', emailErr);
      // Non-fatal - voucher still created
    }
  } else {
    console.log('[Voucher POST] Email not sent. send_email:', send_email, 'recipient_email:', recipient_email);
  }

  return NextResponse.json({ voucher }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) return unauthorizedResponse();

  const supabase = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const url = new URL(request.url);
  const id = url.pathname.split('/').pop();

  if (!id) {
    return NextResponse.json({ error: 'Voucher ID required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('gift_vouchers')
    .delete()
    .eq('id', id)
    .eq('org_id', session.org_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function sendVoucherEmail(voucher: any) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');

  const [{ Resend }, QRCode] = await Promise.all([
    import('resend'),
    import('qrcode'),
  ]);
  const resend = new Resend(apiKey);

  const valueText =
    voucher.voucher_type === 'amount' ? `\u00a3${Number(voucher.amount).toFixed(2)}`
    : voucher.voucher_type === 'percent' ? `${voucher.percent_discount}% off`
    : `Free ${voucher.item_name}`;

  const expiryText = voucher.expires_at
    ? `Valid until: ${new Date(voucher.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : 'No expiry date';

  // Generate QR code as base64 data URL
  const qrDataUrl = await QRCode.toDataURL(voucher.code, {
    width: 200,
    margin: 2,
    color: { dark: '#1a1a1a', light: '#ffffff' },
  });

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'noreply@rewards.penkey.co.uk',
    replyTo: process.env.RESEND_REPLY_TO_EMAIL,
    to: voucher.recipient_email,
    subject: `Your Penkey Gift Voucher \u2013 ${valueText}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background:#e97c2c;padding:32px 24px;text-align:center;">
      <div style="font-size:32px;font-weight:900;color:#fff;letter-spacing:-1px;">PENKEY</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;text-transform:uppercase;letter-spacing:2px;">Gift Voucher</div>
    </div>
    <!-- Value -->
    <div style="padding:32px 24px;text-align:center;border-bottom:1px solid #f0f0f0;">
      ${voucher.recipient_name ? `<p style="margin:0 0 8px;color:#666;font-size:14px;">For ${voucher.recipient_name}</p>` : ''}
      <div style="font-size:48px;font-weight:900;color:#e97c2c;">${valueText}</div>
      <!-- QR Code -->
      <div style="margin:20px auto;display:inline-block;background:#f9f9f9;border-radius:12px;padding:16px;">
        <img src="${qrDataUrl}" width="160" height="160" alt="Voucher QR Code" style="display:block;" />
      </div>
      <div style="background:#f9f9f9;border-radius:12px;padding:16px;margin-top:0;">
        <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Voucher Code</div>
        <div style="font-size:26px;font-weight:700;color:#1a1a1a;letter-spacing:4px;">${voucher.code}</div>
      </div>
      ${voucher.message ? `<p style="margin:16px 0 0;color:#555;font-style:italic;">"${voucher.message}"</p>` : ''}
    </div>
    <!-- Footer -->
    <div style="padding:20px 24px;text-align:center;background:#fafafa;">
      <p style="margin:0;color:#999;font-size:12px;">${expiryText}</p>
      <p style="margin:8px 0 0;color:#999;font-size:12px;">Scan the QR code or present this code in-store to redeem.</p>
      <p style="margin:16px 0 0;color:#ccc;font-size:11px;">Penkey Delicaf\u00e9 &amp; Gifts &middot; Lymington</p>
    </div>
  </div>
</body>
</html>`,
  });
}
