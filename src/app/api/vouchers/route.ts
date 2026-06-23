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

  const [{ Resend }] = await Promise.all([
    import('resend'),
  ]);
  const resend = new Resend(apiKey);

  const storeName = voucher.storeName || 'Penkey';
  const storeAddress = voucher.storeAddress || '';

  const valueText =
    voucher.voucher_type === 'amount' ? `\u00a3${Number(voucher.amount).toFixed(2)}`
    : voucher.voucher_type === 'percent' ? `${voucher.percent_discount}% OFF`
    : `Free ${voucher.item_name}`;

  const expiryText = voucher.expires_at
    ? `Valid until: ${new Date(voucher.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : 'No expiry date';

  // Generate PNG voucher image (contains all details: name, QR, code, expiry, etc.)
  let pngBuffer: Buffer | undefined;
  try {
    const { generateVoucherPng } = await import('@/lib/voucher/voucher-template');
    pngBuffer = await generateVoucherPng({
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
  } catch (err) {
    console.error('[Voucher Email] PNG generation failed:', err);
  }

  const attachment = pngBuffer ? [{
    filename: `voucher-${voucher.code}.png`,
    content: pngBuffer.toString('base64'),
    content_type: 'image/png',
  }] : undefined;

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
  <div style="max-width:480px;margin:0 auto;padding:20px 16px;text-align:center;">
    ${pngBuffer ? `<img src="data:image/png;base64,${pngBuffer.toString('base64')}" alt="${storeName} Gift Voucher" style="width:100%;max-width:400px;height:auto;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.15);" />` : `
      <div style="background:#1a2847;border-radius:12px;padding:32px 24px;color:#fff;">
        <div style="font-size:28px;font-weight:700;letter-spacing:2px;">${storeName}</div>
        <div style="font-size:11px;color:#c9a96e;text-transform:uppercase;letter-spacing:6px;margin-top:8px;">Gift Voucher</div>
        <div style="font-size:48px;font-weight:700;color:#c9a96e;margin-top:24px;">${valueText}</div>
        <div style="font-size:22px;font-weight:700;letter-spacing:4px;font-family:Courier New,monospace;margin-top:24px;">${voucher.code}</div>
        <div style="font-size:14px;margin-top:16px;">${expiryText}</div>
      </div>
    `}
    <p style="margin:16px 0 0;color:#aaa;font-size:11px;font-family:Arial,sans-serif;">You received this email because a gift voucher was purchased for you at ${storeName}.</p>
  </div>
</body>
</html>`,
  });
}
