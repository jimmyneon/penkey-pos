import Handlebars from "handlebars";

const RECEIPT_WIDTH = 42;

export interface ReceiptData {
  store_name: string;
  store_address?: string;
  store_phone?: string;
  receipt_number: number;
  date: string;
  time: string;
  employee_name: string;
  register_name: string;
  lines: Array<{
    quantity: number;
    item_name: string;
    variant_name?: string;
    modifiers?: Array<{ name: string; price_adjustment: number }>;
    line_total: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  payment_method: string;
  cash_tendered?: number;
  cash_change?: number;
  // Transaction metadata
  dining_option?: string;
  table_number?: string | null;
  transaction_id?: string;
  customer_name?: string | null;
}

// ── Helper functions for alignment ──

/**
 * Build a left/right aligned line padded to exactly RECEIPT_WIDTH characters.
 * If the left text is too long it is truncated with "...".
 */
function alignLine(left: string, right: string, width: number = RECEIPT_WIDTH): string {
  const maxLeft = width - right.length - 1;
  const truncated = left.length > maxLeft ? left.substring(0, maxLeft - 3) + '...' : left;
  const padding = width - truncated.length - right.length;
  return truncated + ' '.repeat(Math.max(1, padding)) + right;
}

/**
 * Build a horizontal rule of exactly RECEIPT_WIDTH dashes.
 */
function horizontalRule(width: number = RECEIPT_WIDTH): string {
  return '-'.repeat(width);
}

/**
 * Format a number as currency with £ symbol.
 * \xA3 = Unicode U+00A3 = £. Print server encodes with cp858 → byte 0x9C → prints as £.
 */
function currency(value: number): string {
  return `\xA3${value.toFixed(2)}`;
}

// ── Register Handlebars helpers ──

Handlebars.registerHelper("currency", (value: number) => currency(value));
Handlebars.registerHelper("eq", (a: any, b: any) => a === b);
Handlebars.registerHelper("alignLine", (left: string, right: string) => alignLine(left, right));
Handlebars.registerHelper("hr", () => horizontalRule());

// ── Receipt text generator (no Handlebars – direct builder for reliability) ──

export function generateReceiptText(data: ReceiptData): string {
  const lines: string[] = [];

  // Header (centre-aligned by print server when it sees these lines)
  lines.push(data.store_name);
  if (data.store_address) lines.push(data.store_address);
  if (data.store_phone) lines.push(data.store_phone);
  lines.push('');

  // Divider
  lines.push(horizontalRule());

  // Items
  for (const item of data.lines) {
    const name = item.variant_name
      ? `${item.quantity}x ${item.item_name} - ${item.variant_name}`
      : `${item.quantity}x ${item.item_name}`;
    lines.push(alignLine(name, currency(item.line_total)));

    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        const modText = mod.price_adjustment
          ? `  + ${mod.name} (${currency(mod.price_adjustment)})`
          : `  + ${mod.name}`;
        lines.push(modText);
      }
    }
  }

  // Divider
  lines.push(horizontalRule());
  lines.push('');

  // Totals
  lines.push(alignLine('Subtotal', currency(data.subtotal)));
  if (data.tax > 0) {
    lines.push(alignLine('Tax (20%)', currency(data.tax)));
  }

  // TOTAL – bold markers for the print server
  lines.push(`**${alignLine('TOTAL', currency(data.total))}**`);

  lines.push('');

  // Cash details
  if (data.payment_method === 'cash' && data.cash_tendered != null) {
    lines.push(alignLine('Cash Tendered', currency(data.cash_tendered)));
    if (data.cash_change != null) {
      lines.push(alignLine('Change', currency(data.cash_change)));
    }
    lines.push('');
  }

  // Payment + metadata
  lines.push(data.payment_method);
  lines.push(`${data.date} ${data.time}`);
  
  // Transaction details
  if (data.transaction_id) {
    lines.push(`Transaction ID: ${data.transaction_id}`);
  }
  lines.push(`Order #${data.receipt_number}`);
  
  // Dining option and table
  if (data.dining_option) {
    const diningText = data.dining_option === 'eat-in' ? 'Eat In' : 'Takeaway';
    if (data.table_number && data.dining_option === 'eat-in') {
      lines.push(`${diningText} - Table ${data.table_number}`);
    } else {
      lines.push(diningText);
    }
  }
  
  // Customer name if provided
  if (data.customer_name) {
    lines.push(`Customer: ${data.customer_name}`);
  }
  
  lines.push('');

  // Footer
  lines.push('Thank you for visiting');

  return lines.join('\n');
}

// ── Exported helpers for use by other modules ──
export { alignLine, horizontalRule, currency, RECEIPT_WIDTH };

export function generateReceiptHTML(data: ReceiptData): string {
  const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      max-width: 300px;
      margin: 0 auto;
      padding: 10px;
    }
    .header {
      text-align: center;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .info {
      margin-bottom: 10px;
    }
    .line {
      border-top: 1px dashed #000;
      margin: 10px 0;
    }
    .item {
      margin: 5px 0;
    }
    .item-header {
      display: flex;
      justify-content: space-between;
    }
    .modifier {
      margin-left: 20px;
      font-size: 11px;
    }
    .totals {
      margin-top: 10px;
    }
    .total-line {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
    }
    .grand-total {
      font-weight: bold;
      font-size: 14px;
    }
    .footer {
      text-align: center;
      margin-top: 15px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>${data.store_name}</div>
    ${data.store_address ? `<div>${data.store_address}</div>` : ""}
  </div>
  
  <div class="info">
    <div>Receipt #${data.receipt_number}</div>
    <div>${data.date} ${data.time}</div>
    <div>Served by: ${data.employee_name}</div>
    <div>Register: ${data.register_name}</div>
  </div>
  
  <div class="line"></div>
  
  ${data.lines
    .map(
      (line) => `
    <div class="item">
      <div class="item-header">
        <span>${line.quantity}x ${line.item_name}${line.variant_name ? ` - ${line.variant_name}` : ""}</span>
        <span>£${line.line_total.toFixed(2)}</span>
      </div>
      ${
        line.modifiers && line.modifiers.length > 0
          ? line.modifiers
              .map(
                (mod) =>
                  `<div class="modifier">+ ${mod.name}${mod.price_adjustment ? ` (£${mod.price_adjustment.toFixed(2)})` : ""}</div>`
              )
              .join("")
          : ""
      }
    </div>
  `
    )
    .join("")}
  
  <div class="line"></div>
  
  <div class="totals">
    <div class="total-line">
      <span>Subtotal:</span>
      <span>£${data.subtotal.toFixed(2)}</span>
    </div>
    <div class="total-line">
      <span>Tax (20%):</span>
      <span>£${data.tax.toFixed(2)}</span>
    </div>
    <div class="line"></div>
    <div class="total-line grand-total">
      <span>TOTAL:</span>
      <span>£${data.total.toFixed(2)}</span>
    </div>
    <div class="line"></div>
    
    ${
      data.payment_method === "cash"
        ? `
      <div class="total-line">
        <span>Cash Tendered:</span>
        <span>£${data.cash_tendered?.toFixed(2)}</span>
      </div>
      <div class="total-line">
        <span>Change:</span>
        <span>£${data.cash_change?.toFixed(2)}</span>
      </div>
    `
        : ""
    }
  </div>
  
  <div class="footer">
    <div>Thank you for your custom!</div>
    <div>Please visit again soon</div>
  </div>
</body>
</html>
  `;
  
  return htmlTemplate;
}
