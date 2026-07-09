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
    item_ids,
    category_id,
    category_ids,
    item_selection_type = 'single',
    recipient_name,
    recipient_email,
    expires_at,
    message,
    send_email,
    quantity = 1,
    batch_label,
    voucher_title,
    custom_code,
    min_spend,
  } = body;

  const validTypes = ['amount', 'item', 'percent'];
  if (!validTypes.includes(voucher_type)) {
    return NextResponse.json({ error: 'Invalid voucher_type' }, { status: 400 });
  }

  const qty = Math.min(Math.max(parseInt(quantity) || 1, 1), 100);
  const isBatch = qty > 1;
  const batchId = isBatch ? crypto.randomUUID() : null;
  const orgId = session.org_id;

  // Generate unique code helper
  async function makeUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const c = generateVoucherCode();
      const { data: existing } = await supabase
        .from('gift_vouchers')
        .select('id')
        .eq('org_id', orgId)
        .eq('code', c)
        .maybeSingle();
      if (!existing) return c;
    }
    return generateVoucherCode() + Math.floor(Math.random() * 100);
  }

  const createdVouchers: any[] = [];

  // If custom_code is provided, validate uniqueness upfront
  if (custom_code) {
    const { data: existing } = await supabase
      .from('gift_vouchers')
      .select('id')
      .eq('org_id', orgId)
      .eq('code', custom_code)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'A voucher with this code already exists' }, { status: 409 });
    }
  }

  for (let i = 0; i < qty; i++) {
    // Use custom_code if provided (only for single voucher, not batch)
    const code = (custom_code && !isBatch) ? custom_code : await makeUniqueCode();
    const qrData = JSON.stringify({ type: 'voucher', code, org_id: session.org_id });

    const { data: voucher, error: insertError } = await supabase
      .from('gift_vouchers')
      .insert({
        org_id: session.org_id,
        code,
        qr_data: qrData,
        voucher_type,
        amount: voucher_type === 'amount' ? amount : null,
        percent_discount: voucher_type === 'percent' ? percent_discount : null,
        item_id: voucher_type === 'item' && item_selection_type === 'single' ? item_id : null,
        item_name: voucher_type === 'item' ? item_name : null,
        item_ids: voucher_type === 'item' && item_selection_type === 'multiple' ? item_ids : null,
        category_id: voucher_type === 'item' && item_selection_type === 'category' && category_ids && category_ids.length === 1 ? category_ids[0] : (voucher_type === 'item' && item_selection_type === 'category' ? category_id : null),
        category_ids: voucher_type === 'item' && item_selection_type === 'category' && category_ids && category_ids.length > 0 ? category_ids : null,
        item_selection_type: voucher_type === 'item' ? item_selection_type : null,
        recipient_name: recipient_name || null,
        recipient_email: recipient_email || null,
        expires_at: expires_at || null,
        message: message || null,
        voucher_title: voucher_title || null,
        min_spend: (voucher_type === 'amount' || voucher_type === 'percent') ? (parseFloat(min_spend) || 0) : 0,
        issued_by: session.user_id,
        status: 'active',
        batch_id: batchId,
        batch_label: batch_label || null,
        is_reusable: !!custom_code,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Voucher POST] Insert error on item', i, insertError);
      if (i === 0) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      break;
    }

    createdVouchers.push(voucher);

    // Send email if requested (only for single or first of batch with recipient)
    if (send_email && recipient_email && voucher && !isBatch) {
      try {
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
        await sendVoucherEmail({ ...(voucher as any), storeName, storeAddress });
      } catch (emailErr) {
        console.error('[Voucher POST] Email failed:', emailErr);
      }
    }
  }

  if (isBatch) {
    return NextResponse.json({
      vouchers: createdVouchers,
      batch_id: batchId,
      batch_label: batch_label || null,
      count: createdVouchers.length,
    }, { status: 201 });
  }

  return NextResponse.json({ voucher: createdVouchers[0] }, { status: 201 });
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
    : voucher.voucher_title ? voucher.voucher_title
    : `Free ${voucher.item_name}`;

  const expiryText = voucher.expires_at
    ? `Valid until: ${new Date(voucher.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : 'No expiry date';

  const created = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const recipientName = voucher.recipient_name || '';

  // Generate QR code as data URI for inline display
  let qrDataUrl = '';
  try {
    const QRCode = (await import('qrcode')).default;
    qrDataUrl = await QRCode.toDataURL(voucher.code, {
      width: 200,
      margin: 1,
      color: { dark: '#1a2847', light: '#ffffff' },
    });
  } catch (err) {
    console.error('[Voucher Email] QR generation failed:', err);
  }

  const { data: emailData, error: emailError } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'noreply@rewards.penkey.co.uk',
    replyTo: process.env.RESEND_REPLY_TO_EMAIL,
    to: voucher.recipient_email,
    subject: `Your ${storeName} Gift Voucher \u2013 ${valueText}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:#e8e4dc;font-family:'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <div style="max-width:420px;margin:0 auto;padding:24px 16px;text-align:center;">

    <!-- Voucher Card -->
    <div style="background:#1a2847;border-radius:16px;padding:0;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.2);">

      <!-- Store Name Header -->
      <div style="padding:28px 24px 8px;">
        <div style="font-size:26px;font-weight:800;letter-spacing:3px;color:#f5ebd6;">${storeName}</div>
        <div style="font-size:10px;color:#c9a96e;text-transform:uppercase;letter-spacing:6px;margin-top:6px;">Gift Voucher</div>
      </div>

      ${recipientName ? `
      <div style="padding:16px 24px 0;">
        <div style="font-size:11px;color:rgba(245,235,214,0.5);text-transform:uppercase;letter-spacing:2px;">A gift for</div>
        <div style="font-size:18px;font-weight:700;color:#ffffff;margin-top:4px;">${recipientName}</div>
      </div>` : ''}

      <!-- Value -->
      <div style="padding:24px 24px 8px;">
        <div style="font-size:44px;font-weight:800;color:#c9a96e;line-height:1;">${valueText}</div>
      </div>

      <!-- QR Code -->
      ${qrDataUrl ? `
      <div style="padding:20px 24px 4px;">
        <div style="background:#fff;display:inline-block;padding:8px;border-radius:8px;">
          <img src="${qrDataUrl}" alt="QR Code" style="display:block;width:140px;height:140px;" />
        </div>
      </div>` : ''}

      <!-- Code -->
      <div style="padding:12px 24px 4px;">
        <div style="font-size:10px;color:rgba(245,235,214,0.5);text-transform:uppercase;letter-spacing:3px;">Voucher Code</div>
        <div style="font-size:20px;font-weight:700;letter-spacing:4px;font-family:'Courier New',monospace;color:#ffffff;margin-top:6px;">${voucher.code}</div>
      </div>

      ${voucher.message ? `
      <div style="padding:12px 24px 4px;">
        <div style="font-size:14px;font-style:italic;color:rgba(255,255,255,0.8);line-height:1.5;">&ldquo;${voucher.message}&rdquo;</div>
      </div>` : ''}

      <!-- Footer -->
      <div style="padding:20px 24px 28px;border-top:1px solid rgba(245,235,214,0.1);margin-top:16px;">
        <div style="font-size:13px;font-weight:600;color:#f5ebd6;">${expiryText}</div>
        ${storeAddress ? `<div style="font-size:11px;color:rgba(245,235,214,0.5);margin-top:6px;">${storeAddress}</div>` : ''}
        <div style="font-size:10px;color:rgba(245,235,214,0.3);margin-top:8px;">Issued: ${created}</div>
      </div>
    </div>

    <p style="margin:20px 0 0;color:#888;font-size:12px;line-height:1.5;">
      You received this email because a gift voucher was purchased for you at ${storeName}.<br/>
      Show this email or the QR code above to redeem your voucher.
    </p>
  </div>
</body>
</html>`,
  });

  if (emailError) {
    console.error('[Voucher Email] Resend API error:', emailError);
    throw new Error(`Email send failed: ${emailError.message || JSON.stringify(emailError)}`);
  }

  console.log('[Voucher Email] Sent successfully:', emailData?.id);
}
