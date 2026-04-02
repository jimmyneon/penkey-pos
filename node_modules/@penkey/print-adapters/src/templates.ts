import Handlebars from "handlebars";
import type { ReceiptData, KitchenTicketData } from "./types";

// Register Handlebars helpers
Handlebars.registerHelper("currency", (value: number) => {
  return `£${value.toFixed(2)}`;
});

Handlebars.registerHelper("repeat", (char: string, count: number) => {
  return char.repeat(count);
});

Handlebars.registerHelper("pad", (text: string, width: number) => {
  return text.padEnd(width, " ");
});

export const RECEIPT_TEMPLATE = `
{{repeat "=" 32}}
{{#if customerCopy}}
  CUSTOMER COPY
{{else}}
  MERCHANT COPY
{{/if}}
{{repeat "=" 32}}

{{storeName}}
{{storeAddress}}
{{storePhone}}
VAT: {{vatNumber}}

Date: {{dateTime}}
Receipt: {{receiptNumber}}
Served by: {{employeeName}}

{{repeat "-" 32}}

{{#each lines}}
{{name}}
{{quantity}} x {{currency price}} = {{currency total}}
{{#if modifiers}}
  {{#each modifiers}}
  + {{this}}
  {{/each}}
{{/if}}
{{#if notes}}
  Note: {{notes}}
{{/if}}
{{/each}}

{{repeat "-" 32}}

Subtotal:     {{currency subtotal}}
{{#if discounts}}
Discounts:    -{{currency discounts}}
{{/if}}
VAT (20%):    {{currency tax}}

TOTAL:        {{currency total}}

{{repeat "=" 32}}

{{#each payments}}
{{pad method 20}} {{currency amount}}
{{/each}}
{{#if change}}
Change:       {{currency change}}
{{/if}}

{{repeat "=" 32}}

{{#if footerText}}
{{footerText}}
{{/if}}

Thank you for your visit!

{{repeat " " 3}}
`;

export const KITCHEN_TICKET_TEMPLATE = `
{{repeat "=" 32}}
KITCHEN ORDER
{{repeat "=" 32}}

Ticket: {{ticketNumber}}
Time: {{orderTime}}
Type: {{diningOption}}
{{#if customerName}}
Name: {{customerName}}
{{/if}}
{{#if tableNumber}}
Table: {{tableNumber}}
{{/if}}

{{repeat "-" 32}}

{{#each items}}
{{quantity}}x {{name}}
{{#if modifiers}}
  {{#each modifiers}}
  + {{this}}
  {{/each}}
{{/if}}
{{#if notes}}
  *** {{notes}} ***
{{/if}}

{{/each}}

{{repeat "=" 32}}
`;

export function renderReceipt(data: ReceiptData): string {
  const template = Handlebars.compile(RECEIPT_TEMPLATE);
  return template(data);
}

export function renderKitchenTicket(data: KitchenTicketData): string {
  const template = Handlebars.compile(KITCHEN_TICKET_TEMPLATE);
  return template(data);
}
