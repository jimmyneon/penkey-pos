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

  const storeName = voucher.storeName || 'Penkey';
  const storeAddress = voucher.storeAddress || '';

  const valueText =
    voucher.voucher_type === 'amount' ? `\u00a3${Number(voucher.amount).toFixed(2)}`
    : voucher.voucher_type === 'percent' ? `${voucher.percent_discount}% OFF`
    : `Free ${voucher.item_name}`;

  const voucherSubtext =
    voucher.voucher_type === 'amount' ? 'This voucher can be redeemed for goods to the value shown.'
    : voucher.voucher_type === 'percent' ? 'This voucher gives the stated percentage off your order.'
    : `This voucher entitles you to one free ${voucher.item_name}.`;

  const expiryText = voucher.expires_at
    ? `Valid until: ${new Date(voucher.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : 'No expiry date';

  const qrDataUrl = await QRCode.toDataURL(voucher.code, {
    width: 240,
    margin: 2,
    color: { dark: '#1a2847', light: '#ffffff' },
  });

  // Generate PNG attachment
  let attachment: any[] | undefined;
  try {
    const { generateVoucherPng } = await import('@/lib/voucher/voucher-template');
    const pngBuffer = await generateVoucherPng({
      code: voucher.code,
      voucher_type: voucher.voucher_type,
      amount: voucher.amount,
      percent_discount: voucher.percent_discount,
      item_name: voucher.item_name,
      recipient_name: voucher.recipient_name,
      recipient_email: voucher.recipient_email,
      message: voucher.message,
      expires_at: voucher.expires_at,
      storeName,
      storeAddress,
    });
    attachment = [{
      filename: `voucher-${voucher.code}.png`,
      content: pngBuffer.toString('base64'),
      content_type: 'image/png',
    }];
  } catch (err) {
    console.error('[Voucher Email] PNG generation failed, sending without attachment:', err);
  }

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'noreply@rewards.penkey.co.uk',
    replyTo: process.env.RESEND_REPLY_TO_EMAIL,
    to: voucher.recipient_email,
    subject: `Your ${storeName} Gift Voucher \u2013 ${valueText}`,
    attachments: attachment,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#e8e4dc;font-family:Georgia,serif;">
  <div style="max-width:480px;margin:40px auto;background:#1a2847;border-radius:12px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.15);">

    <!-- Navy top section -->
    <div style="padding:40px 32px 32px;text-align:center;background:linear-gradient(135deg,#1a2847 0%,#243556 100%);">
      <div style="font-size:32px;font-weight:700;color:#ffffff;letter-spacing:2px;font-family:Georgia,serif;">${storeName}</div>
      <div style="width:60px;height:2px;background:#c9a96e;margin:12px auto;"></div>
      <div style="font-size:13px;color:#c9a96e;text-transform:uppercase;letter-spacing:6px;font-family:Arial,sans-serif;font-weight:600;">Gift Voucher</div>
      ${voucher.recipient_name ? `
      <div style="margin-top:24px;">
        <div style="font-size:14px;color:#f5ebd6;opacity:0.7;font-family:Georgia,serif;">A gift for</div>
        <div style="font-size:24px;color:#ffffff;font-weight:600;font-family:Georgia,serif;margin-top:4px;">${voucher.recipient_name}</div>
      </div>
      ` : ''}
      <div style="font-size:${valueText.length > 10 ? '48px' : '64px'};font-weight:700;color:#c9a96e;font-family:Georgia,serif;margin-top:${voucher.recipient_name ? '20px' : '32px'};line-height:1;">${valueText}</div>
    </div>

    <!-- Cream middle section -->
    <div style="background:#f5ebd6;padding:32px 28px;text-align:center;">
      <p style="margin:0 0 20px;color:#8a8a8a;font-size:13px;line-height:1.5;font-family:Arial,sans-serif;">${voucherSubtext}</p>

      <div style="border-top:2px dashed #e8dcc0;margin:0 20px 24px;"></div>

      <!-- QR Code -->
      <div style="display:inline-block;background:#ffffff;border-radius:10px;padding:10px;margin-bottom:16px;border:1px solid #e8dcc0;">
        <img src="${qrDataUrl}" width="160" height="160" alt="Voucher QR Code" style="display:block;" />
      </div>

      <!-- Voucher code -->
      <div style="font-size:10px;color:#8a8a8a;text-transform:uppercase;letter-spacing:3px;font-family:Arial,sans-serif;margin-bottom:6px;">Voucher Code</div>
      <div style="font-size:26px;font-weight:700;color:#1a2847;letter-spacing:4px;font-family:Courier New,monospace;">${voucher.code}</div>

      ${voucher.message ? `
      <div style="border-top:1px dashed #e8dcc0;margin:24px 20px 16px;"></div>
      <p style="margin:0;color:#2a2a2a;font-style:italic;font-size:15px;line-height:1.6;font-family:Georgia,serif;">&ldquo;${voucher.message}&rdquo;</p>
      ` : ''}
    </div>

    <!-- Terms on cream -->
    <div style="background:#f5ebd6;padding:0 28px 24px;">
      <div style="border-top:1px solid #e8dcc0;margin-bottom:16px;"></div>
      <div style="font-size:10px;color:#8a8a8a;line-height:1.7;font-family:Arial,sans-serif;text-align:left;">
        <p style="margin:0 0 4px;">This voucher is valid for redemption at ${storeName} only.</p>
        <p style="margin:0 0 4px;">Present this voucher or quote the code above at the time of purchase.</p>
        <p style="margin:0 0 4px;">Cannot be exchanged for cash. No change will be given for partial redemption.</p>
        <p style="margin:0;">Lost or stolen vouchers cannot be replaced.</p>
      </div>
    </div>

    <!-- Navy bottom section -->
    <div style="background:linear-gradient(135deg,#243556 0%,#1a2847 100%);padding:28px 32px;text-align:center;">
      <div style="width:60px;height:1px;background:#c9a96e;opacity:0.5;margin:0 auto 16px;"></div>
      <p style="margin:0 0 6px;color:#ffffff;font-size:14px;font-weight:600;font-family:Arial,sans-serif;">${expiryText}</p>
      ${storeAddress ? `<p style="margin:0 0 6px;color:#f5ebd6;opacity:0.6;font-size:12px;font-family:Arial,sans-serif;">${storeAddress}</p>` : ''}
      <p style="margin:12px 0 0;color:#f5ebd6;opacity:0.4;font-size:11px;font-family:Arial,sans-serif;">Scan the QR code or present this code in-store to redeem</p>
    </div>
  </div>

  <p style="text-align:center;color:#aaa;font-size:11px;font-family:Arial,sans-serif;margin:16px 0 0;">You received this email because a gift voucher was purchased for you at ${storeName}.</p>
</body>
</html>`,
  });
}
