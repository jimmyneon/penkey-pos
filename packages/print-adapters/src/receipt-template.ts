import Handlebars from "handlebars";

export interface ReceiptData {
  store_name: string;
  store_address?: string;
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
}

// Register Handlebars helpers
Handlebars.registerHelper("currency", (value: number) => {
  // Use ASCII pound sign for CP850 encoding compatibility
  return `\xA3${value.toFixed(2)}`;
});

Handlebars.registerHelper("eq", (a: any, b: any) => a === b);

const receiptTemplate = `
{{store_name}}
{{#if store_address}}{{store_address}}{{/if}}

Receipt #{{receipt_number}}
{{date}} {{time}}

Served by: {{employee_name}}
Register: {{register_name}}

==================================================
{{#each lines}}
{{quantity}}x {{item_name}}{{#if variant_name}} - {{variant_name}}{{/if}}
{{#if modifiers}}
  {{#each modifiers}}
  + {{name}}{{#if price_adjustment}} ({{currency price_adjustment}}){{/if}}
  {{/each}}
{{/if}}
{{line_total}}
{{/each}}
==================================================

Subtotal: {{currency subtotal}}
Tax (20%): {{currency tax}}
==================================================
TOTAL: {{currency total}}
==================================================

{{#if (eq payment_method "cash")}}
Cash Tendered: {{currency cash_tendered}}
Change: {{currency cash_change}}
{{/if}}

Thank you for your custom!

Please visit again soon
`;

export function generateReceiptText(data: ReceiptData): string {
  const template = Handlebars.compile(receiptTemplate);
  return template(data);
}

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
