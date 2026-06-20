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

  const voucherSubtext =
    voucher.voucher_type === 'amount' ? 'This voucher can be redeemed for goods to the value shown.'
    : voucher.voucher_type === 'percent' ? 'This voucher gives the stated percentage off your order.'
    : `This voucher entitles you to one free ${voucher.item_name}.`;

  const expiryText = voucher.expires_at
    ? `Valid until: ${new Date(voucher.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : 'No expiry date';

  // Generate QR code as base64 data URL
  const qrDataUrl = await QRCode.toDataURL(voucher.code, {
    width: 240,
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
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <!-- Gradient Header -->
    <div style="background:linear-gradient(135deg,#e97c2c 0%,#d45f10 100%);padding:32px 24px;text-align:center;">
      <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-1px;">PENKEY</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.8);margin-top:4px;text-transform:uppercase;letter-spacing:3px;">Delicaf\u00e9 &amp; Gifts</div>
    </div>

    <!-- Gift Voucher Title -->
    <div style="padding:24px 24px 8px;text-align:center;">
      <div style="font-size:12px;font-weight:600;color:#e97c2c;text-transform:uppercase;letter-spacing:4px;">Gift Voucher</div>
    </div>

    <!-- Recipient -->
    ${voucher.recipient_name ? `<div style="padding:0 24px 8px;text-align:center;"><p style="margin:0;color:#666;font-size:14px;">A gift for <strong style="color:#333;">${voucher.recipient_name}</strong></p></div>` : ''}

    <!-- Value -->
    <div style="padding:16px 24px 24px;text-align:center;">
      <div style="font-size:52px;font-weight:900;color:#e97c2c;line-height:1;">${valueText}</div>
      <p style="margin:12px 0 0;color:#888;font-size:12px;line-height:1.5;">${voucherSubtext}</p>
    </div>

    <!-- Dashed Divider -->
    <div style="padding:0 24px;">
      <div style="border-top:2px dashed #e0e0e0;"></div>
    </div>

    <!-- QR Code + Code -->
    <div style="padding:24px;text-align:center;">
      <div style="display:inline-block;background:#f9f9f9;border-radius:12px;padding:12px;margin-bottom:12px;">
        <img src="${qrDataUrl}" width="160" height="160" alt="Voucher QR Code" style="display:block;" />
      </div>
      <div style="background:#f9f9f9;border-radius:10px;padding:12px 16px;display:inline-block;">
        <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Voucher Code</div>
        <div style="font-size:24px;font-weight:700;color:#1a1a1a;letter-spacing:4px;">${voucher.code}</div>
      </div>
    </div>

    <!-- Message -->
    ${voucher.message ? `<div style="padding:0 24px 16px;text-align:center;"><p style="margin:0;color:#555;font-style:italic;font-size:14px;line-height:1.6;">&ldquo;${voucher.message}&rdquo;</p></div>` : ''}

    <!-- Terms -->
    <div style="padding:16px 24px;border-top:1px solid #f0f0f0;">
      <div style="font-size:10px;color:#aaa;line-height:1.6;">
        <p style="margin:0 0 3px;">This voucher is valid for redemption at Penkey Delicaf\u00e9 &amp; Gifts only.</p>
        <p style="margin:0 0 3px;">Present this voucher or quote the code above at the time of purchase.</p>
        <p style="margin:0 0 3px;">Cannot be exchanged for cash. No change will be given for partial redemption.</p>
        <p style="margin:0;">Lost or stolen vouchers cannot be replaced.</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:20px 24px;text-align:center;background:#fafafa;">
      <p style="margin:0;color:#555;font-size:12px;font-weight:600;">${expiryText}</p>
      <p style="margin:8px 0 0;color:#999;font-size:11px;">Scan the QR code or present this code in-store to redeem.</p>
      <p style="margin:16px 0 0;color:#ccc;font-size:10px;">Penkey Delicaf\u00e9 &amp; Gifts &middot; Lymington</p>
    </div>
  </div>
</body>
</html>`,
  });
}
