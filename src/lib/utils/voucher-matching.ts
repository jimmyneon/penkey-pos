import type { VoucherDiscount } from "@/lib/store/cart-store";

interface MatchableLine {
  id: string;
  item_id: string;
  item_name: string;
  category_id: string | null;
  unit_price: number;
  modifiers: { price_adjustment: number }[];
  quantity: number;
  voucher?: VoucherDiscount;
}

/**
 * Find the cheapest eligible cart line for a free_item voucher.
 * Returns the line with the lowest unit_price (including modifiers) that:
 * - Has no existing voucher applied
 * - Matches the voucher's item_selection_type criteria
 */
export function findCheapestEligibleLine(
  lines: MatchableLine[],
  voucher: {
    item_selection_type?: string;
    item_ids?: string[];
    category_ids?: string[];
    category_id?: string;
    item_name?: string;
  }
): MatchableLine | null {
  const eligibleLines = lines.filter((line) => {
    // Skip lines that already have a voucher
    if (line.voucher) return false;

    if (voucher.item_selection_type === "multiple" && voucher.item_ids) {
      return voucher.item_ids.includes(line.item_id);
    }

    if (voucher.item_selection_type === "category" && (voucher.category_ids?.length || voucher.category_id)) {
      const catIds = voucher.category_ids?.length ? voucher.category_ids : [voucher.category_id!];
      return catIds.includes(line.category_id || "");
    }

    // Single item — match by name (case-insensitive contains)
    if (voucher.item_name) {
      return line.item_name.toLowerCase().includes(voucher.item_name.toLowerCase());
    }

    return false;
  });

  if (eligibleLines.length === 0) return null;

  // Sort by effective unit price (unit_price + modifier adjustments) ascending — cheapest first
  eligibleLines.sort((a, b) => {
    const aPrice = a.unit_price + a.modifiers.reduce((s, m) => s + m.price_adjustment, 0);
    const bPrice = b.unit_price + b.modifiers.reduce((s, m) => s + m.price_adjustment, 0);
    return aPrice - bPrice;
  });

  return eligibleLines[0];
}
