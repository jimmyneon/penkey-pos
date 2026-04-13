/**
 * Receipt Builder Service
 * Handles receipt template building and formatting on the app side.
 * Print server acts as simple rendering layer only.
 */

export interface ReceiptItem {
  item_name: string;
  quantity: number;
  line_total: number;
}

export interface ReceiptData {
  header: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;
  payment_method: string;
  date: string;
  time: string;
  receipt_number: number;
  footer: string;
}

/**
 * Build a left/right aligned line with exactly 42 characters.
 * @param left - Left-aligned text (e.g., item name)
 * @param right - Right-aligned text (e.g., price)
 * @param width - Total line width (default 42 for 80mm paper)
 * @returns Formatted line with exactly width characters
 */
export function buildAlignedLine(left: string, right: string, width: number = 42): string {
  // Truncate left text if too long (reserve space for price)
  const maxLeftLength = width - right.length - 2; // -2 for minimum spacing
  const truncatedLeft = left.length > maxLeftLength ? left.substring(0, maxLeftLength - 3) + '...' : left;
  
  // Calculate spacing needed
  const spacing = width - truncatedLeft.length - right.length;
  const safeSpacing = Math.max(1, spacing);
  
  return truncatedLeft + ' '.repeat(safeSpacing) + right;
}

/**
 * Build a receipt from template data.
 * @param data - Receipt data including header, items, totals, footer
 * @returns Formatted receipt text ready for print server
 */
export function buildReceipt(data: ReceiptData): string {
  const lines: string[] = [];
  const width = 42;

  // Header (centre aligned - app handles centering)
  lines.push(data.header);
  lines.push('');

  // Divider
  lines.push('-'.repeat(width));

  // Items (left/right aligned)
  for (const item of data.items) {
    const itemName = `${item.quantity}x ${item.item_name}`;
    const price = `£${item.line_total.toFixed(2)}`;
    lines.push(buildAlignedLine(itemName, price, width));
  }

  // Divider
  lines.push('-'.repeat(width));
  lines.push('');

  // Totals
  lines.push(buildAlignedLine('Subtotal', `£${data.subtotal.toFixed(2)}`, width));
  lines.push(buildAlignedLine('Tax', `£${data.tax.toFixed(2)}`, width));
  
  // TOTAL (bold marker)
  lines.push(buildAlignedLine('**TOTAL**', `£${data.total.toFixed(2)}`, width));
  
  lines.push('');

  // Payment + metadata
  lines.push(data.payment_method);
  lines.push(`${data.date} ${data.time}`);
  lines.push(`Order #${data.receipt_number}`);

  lines.push('');

  // Footer (centre aligned)
  lines.push(data.footer);

  // Blank lines before cut
  lines.push('');
  lines.push('');
  lines.push('');

  return lines.join('\n');
}

/**
 * Format currency with £ symbol.
 * @param amount - Amount to format
 * @returns Formatted currency string (e.g., "£9.50")
 */
export function formatCurrency(amount: number): string {
  return `£${amount.toFixed(2)}`;
}
