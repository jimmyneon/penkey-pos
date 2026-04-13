/**
 * Receipt Builder Service
 * Re-exports the canonical receipt builder from @penkey/print-adapters.
 * All receipt formatting logic lives in the print-adapters package.
 * This module provides a convenience layer for the app.
 */

export {
  generateReceiptText as buildReceipt,
  alignLine as buildAlignedLine,
  currency as formatCurrency,
  horizontalRule,
  RECEIPT_WIDTH,
  type ReceiptData,
} from "@penkey/print-adapters";
