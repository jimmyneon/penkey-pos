/**
 * Order Email Notification Service
 * Sends email notifications when online orders are received.
 */

const NOTIFICATION_EMAIL = "pinkygifts@gmail.com";

export async function sendOrderNotificationEmail(order: any): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Order Email] RESEND_API_KEY not configured, skipping notification");
    return;
  }

  const [{ Resend }] = await Promise.all([import("resend")]);
  const resend = new Resend(apiKey);

  const orderNumber = order.order_number || order.id?.slice(0, 8) || "Unknown";
  const customerName = order.customer_name || "Walk-in";
  const customerPhone = order.customer_phone || "N/A";
  const diningOption = order.dining_option === "eat-in" ? "Eat In" : "Takeaway";
  const orderTime = new Date(order.created_at || Date.now()).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const itemsHtml = (order.lines || [])
    .map(
      (l: any) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${l.quantity || 1}x ${l.item_name || l.name || "Item"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">&pound;${((l.unit_price || 0) * (l.quantity || 1)).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  const notesHtml = order.notes
    ? `<div style="margin-top:16px;padding:12px;background:#fff3cd;border-radius:8px;"><strong>Notes:</strong> ${order.notes}</div>`
    : "";

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "noreply@rewards.penkey.co.uk",
    replyTo: process.env.RESEND_REPLY_TO_EMAIL,
    to: NOTIFICATION_EMAIL,
    subject: `New Online Order #${orderNumber} - ${orderTime}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <div style="max-width:500px;margin:0 auto;padding:24px 16px;">
    <div style="background:#1a2847;border-radius:12px;padding:24px;color:#fff;">
      <h1 style="margin:0 0 4px;font-size:22px;">New Online Order</h1>
      <p style="margin:0;color:#c9a96e;font-size:14px;">Order #${orderNumber}</p>
    </div>

    <div style="background:#fff;border-radius:0 0 12px 12px;padding:24px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
        <div>
          <div style="font-size:12px;color:#999;text-transform:uppercase;">Customer</div>
          <div style="font-weight:600;">${customerName}</div>
          ${customerPhone !== "N/A" ? `<div style="font-size:14px;color:#666;">${customerPhone}</div>` : ""}
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px;color:#999;text-transform:uppercase;">Time</div>
          <div style="font-weight:600;">${orderTime}</div>
          <div style="font-size:14px;color:#666;">${diningOption}</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="border-bottom:2px solid #1a2847;">
            <th style="padding:8px 12px;text-align:left;">Item</th>
            <th style="padding:8px 12px;text-align:right;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td style="padding:12px;font-weight:bold;font-size:16px;">Total</td>
            <td style="padding:12px;text-align:right;font-weight:bold;font-size:16px;">&pound;${(order.total || 0).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      ${notesHtml}

      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:13px;color:#999;">
        This is an automated notification. Check the Orders tab in your POS to accept and manage this order.
      </div>
    </div>
  </div>
</body>
</html>`,
  });

  if (error) {
    console.error("[Order Email] Resend API error:", error);
    throw new Error(`Email send failed: ${error.message || JSON.stringify(error)}`);
  }

  console.log("[Order Email] Notification sent for order:", orderNumber);
}
