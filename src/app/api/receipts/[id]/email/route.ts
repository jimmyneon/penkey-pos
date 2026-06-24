export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";

function formatCurrency(amount: number, currency = 'GBP') {
  const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';
  return `${symbol}${Number(amount).toFixed(2)}`;
}

function buildReceiptHtml(receipt: any, lines: any[], orgName: string) {
  const storeName = receipt.store?.name || orgName || 'Penkey';
  const storeAddress = receipt.store?.address || '';
  const storePhone = receipt.store?.phone || '';
  const receiptDate = new Date(receipt.created_at).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const employeeName = receipt.member
    ? `${receipt.member.first_name} ${receipt.member.last_name}`
    : '';
  const registerName = receipt.register?.name || '';

  const linesHtml = (lines || []).map((line: any) => {
    const modifiersText = line.modifiers && Array.isArray(line.modifiers) && line.modifiers.length > 0
      ? line.modifiers.map((m: any) => `+ ${m.name}${m.price > 0 ? ` (${formatCurrency(m.price)})` : ''}`).join('<br/>')
      : '';
    return `
      <tr>
        <td style="padding:6px 0;vertical-align:top;">
          <div style="font-weight:600;color:#1a2847;">${line.name}</div>
          ${modifiersText ? `<div style="font-size:12px;color:#666;margin-left:12px;">${modifiersText}</div>` : ''}
          ${line.notes ? `<div style="font-size:12px;color:#999;font-style:italic;margin-left:12px;">Note: ${line.notes}</div>` : ''}
          <div style="font-size:12px;color:#666;margin-top:2px;">${line.quantity} × ${formatCurrency(line.unit_price)}</div>
        </td>
        <td style="padding:6px 0;text-align:right;vertical-align:top;font-weight:600;color:#1a2847;white-space:nowrap;">
          ${formatCurrency(line.line_total)}
        </td>
      </tr>
    `;
  }).join('');

  const paymentsHtml = (receipt.payments || []).map((p: any) => `
    <div style="display:flex;justify-content:space-between;font-size:13px;color:#666;">
      <span style="text-transform:capitalize;">${p.method}</span>
      <span>${formatCurrency(p.amount)}</span>
    </div>
  `).join('');

  const changeHtml = receipt.change_amount > 0
    ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#666;margin-top:4px;">
        <span>Change Given</span>
        <span>${formatCurrency(receipt.change_amount)}</span>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <div style="max-width:420px;margin:0 auto;padding:20px 16px;">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <!-- Header -->
      <div style="background:#1a2847;padding:24px;text-align:center;">
        <div style="font-size:22px;font-weight:800;letter-spacing:2px;color:#f5ebd6;">${storeName}</div>
        ${storeAddress ? `<div style="font-size:12px;color:rgba(245,235,214,0.6);margin-top:4px;">${storeAddress}</div>` : ''}
        ${storePhone ? `<div style="font-size:12px;color:rgba(245,235,214,0.6);">Tel: ${storePhone}</div>` : ''}
      </div>

      <!-- Receipt Info -->
      <div style="padding:16px 20px;border-bottom:1px solid #eee;">
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#666;margin-bottom:4px;">
          <span>Receipt #</span>
          <span style="font-weight:600;color:#1a2847;">${receipt.receipt_number}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#666;margin-bottom:4px;">
          <span>Date</span>
          <span>${receiptDate}</span>
        </div>
        ${employeeName ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#666;margin-bottom:4px;">
          <span>Served by</span>
          <span>${employeeName}</span>
        </div>` : ''}
        ${registerName ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#666;margin-bottom:4px;">
          <span>Register</span>
          <span>${registerName}</span>
        </div>` : ''}
        ${receipt.dining_option ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#666;">
          <span>Type</span>
          <span>${receipt.dining_option === 'eat-in' ? 'Eat In' : 'Takeaway'}</span>
        </div>` : ''}
        ${receipt.table_number ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#666;">
          <span>Table</span>
          <span>${receipt.table_number}</span>
        </div>` : ''}
      </div>

      <!-- Items -->
      <div style="padding:16px 20px;border-bottom:1px solid #eee;">
        <table style="width:100%;border-collapse:collapse;">
          ${linesHtml}
        </table>
      </div>

      <!-- Totals -->
      <div style="padding:16px 20px;border-bottom:1px solid #eee;">
        <div style="display:flex;justify-content:space-between;font-size:14px;color:#666;margin-bottom:6px;">
          <span>Subtotal</span>
          <span>${formatCurrency(receipt.subtotal)}</span>
        </div>
        ${receipt.discount_total > 0 ? `<div style="display:flex;justify-content:space-between;font-size:14px;color:#e74c3c;margin-bottom:6px;">
          <span>Discount</span>
          <span>-${formatCurrency(receipt.discount_total)}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:14px;color:#666;margin-bottom:6px;">
          <span>Tax (20%)</span>
          <span>${formatCurrency(receipt.tax_total)}</span>
        </div>
        ${receipt.tip_total > 0 ? `<div style="display:flex;justify-content:space-between;font-size:14px;color:#666;margin-bottom:6px;">
          <span>Tip</span>
          <span>${formatCurrency(receipt.tip_total)}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:20px;font-weight:800;color:#1a2847;border-top:2px solid #1a2847;padding-top:10px;margin-top:6px;">
          <span>Total</span>
          <span>${formatCurrency(receipt.total)}</span>
        </div>
      </div>

      <!-- Payment -->
      <div style="padding:16px 20px;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#999;margin-bottom:8px;">Payment</div>
        ${paymentsHtml}
        ${changeHtml}
        ${receipt.refunded_amount > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#e74c3c;margin-top:8px;padding-top:8px;border-top:1px solid #eee;">
          <span>Refunded</span>
          <span>-${formatCurrency(receipt.refunded_amount)}</span>
        </div>` : ''}
      </div>

      <!-- Footer -->
      <div style="padding:16px 20px;background:#fafafa;text-align:center;">
        <div style="font-size:13px;color:#999;">Thank you for your visit!</div>
        <div style="font-size:11px;color:#ccc;margin-top:4px;">This is an electronic receipt from ${storeName}.</div>
      </div>
    </div>

    <p style="text-align:center;color:#aaa;font-size:11px;margin-top:16px;">
      You received this email because a receipt was emailed to you from ${storeName}.<br/>
      If this wasn't you, please contact the store.
    </p>
  </div>
</body>
</html>`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await validatePOSSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { email } = body || {};

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("[Receipt Email] RESEND_API_KEY not configured");
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      );
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch receipt with all details
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select(`
        id,
        receipt_number,
        created_at,
        dining_option,
        customer_name,
        table_number,
        subtotal,
        discount_total,
        tax_total,
        tip_total,
        total,
        paid_amount,
        change_amount,
        refunded_amount,
        status,
        member:org_members!receipts_member_id_fkey (
          first_name,
          last_name
        ),
        store:stores (
          name,
          address,
          phone
        ),
        register:registers (
          name
        ),
        payments (
          id,
          method,
          amount,
          tip_amount,
          reference,
          metadata
        )
      `)
      .eq("id", params.id)
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json(
        { error: "Receipt not found" },
        { status: 404 }
      );
    }

    // Fetch receipt lines
    const { data: lines } = await supabase
      .from("receipt_lines")
      .select("id, name, quantity, unit_price, line_total, modifiers, notes")
      .eq("receipt_id", params.id)
      .order("sort_order", { ascending: true });

    // Fetch org name
    const { data: org } = await supabase
      .from("orgs")
      .select("name")
      .eq("id", session.org_id)
      .single();

    const orgName = (org as any)?.name || "Penkey";
    const storeName = (receipt as any).store?.name || orgName;

    const html = buildReceiptHtml(receipt, lines || [], orgName);

    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'noreply@rewards.penkey.co.uk',
      replyTo: process.env.RESEND_REPLY_TO_EMAIL,
      to: email,
      subject: `Your receipt from ${storeName} - #${(receipt as any).receipt_number}`,
      html,
    });

    if (emailError) {
      console.error("[Receipt Email] Resend API error:", emailError);
      throw new Error(`Email send failed: ${emailError.message || JSON.stringify(emailError)}`);
    }

    console.log("[Receipt Email] Sent successfully:", emailData?.id, "to", email);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to send receipt email:", error);
    return NextResponse.json(
      { error: "Failed to send email", details: error.message },
      { status: 500 }
    );
  }
}
