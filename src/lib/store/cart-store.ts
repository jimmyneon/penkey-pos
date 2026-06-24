import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Get user-scoped storage key to prevent cross-account cart sharing
function getStorageKey() {
  try {
    const session = sessionStorage.getItem("pos_session");
    if (session) {
      const parsed = JSON.parse(session);
      return `pos-cart-storage-${parsed.user_id || 'default'}`;
    }
  } catch {}
  return 'pos-cart-storage';
}

export interface CartModifier {
  id: string;
  name: string;
  price_adjustment: number;
}

export interface VoucherDiscount {
  id: string;
  name: string;
  discountType: 'percentage' | 'fixed' | 'free_item' | 'free_modifier';
  discountValue: number;
  beanCost: number;
  itemType?: string;
  category?: string;
}

export interface BasketDiscount {
  id: string;
  code: string;
  name: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountAmount: number;
}

export interface CartLine {
  id: string; // Unique ID for this cart line
  item_id: string;
  item_name: string;
  variant_id: string | null;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
  modifiers: CartModifier[];
  notes: string;
  tax_rate: number;
  voucher?: VoucherDiscount; // Applied voucher for this line
}

interface CartStore {
  lines: CartLine[];
  basketVoucher: VoucherDiscount | null;
  basketDiscount: BasketDiscount | null;
  addLine: (line: Omit<CartLine, "id">) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  updateNotes: (lineId: string, notes: string) => void;
  clearCart: () => void;
  loadLines: (lines: CartLine[]) => void; // For syncing from database
  applyVoucher: (lineId: string, voucher: VoucherDiscount) => void;
  removeVoucher: (lineId: string) => void;
  setBasketVoucher: (voucher: VoucherDiscount) => void;
  clearBasketVoucher: () => void;
  setBasketDiscount: (discount: BasketDiscount) => void;
  clearBasketDiscount: () => void;
  getSubtotal: () => number;
  getTaxTotal: () => number;
  getTotal: () => number;
  getBasketVoucherDiscount: () => number;
  getBasketDiscountAmount: () => number;
  getVoucherDiscountTotal: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      lines: [],
      basketVoucher: null,
      basketDiscount: null,

  addLine: (line) => {
    set((state) => {
      // Check if an identical line already exists (same item, variant, modifiers, and notes)
      const existingLineIndex = state.lines.findIndex((existingLine) => {
        // Must match: item_id, variant_id, notes
        if (
          existingLine.item_id !== line.item_id ||
          existingLine.variant_id !== line.variant_id ||
          existingLine.notes !== line.notes
        ) {
          return false;
        }

        // Must have same number of modifiers
        if (existingLine.modifiers.length !== line.modifiers.length) {
          return false;
        }

        // Must have identical modifiers (same IDs)
        const existingModifierIds = existingLine.modifiers.map(m => m.id).sort();
        const newModifierIds = line.modifiers.map(m => m.id).sort();
        return existingModifierIds.every((id, i) => id === newModifierIds[i]);
      });

      if (existingLineIndex !== -1) {
        // Increment quantity of existing line
        const updatedLines = [...state.lines];
        updatedLines[existingLineIndex] = {
          ...updatedLines[existingLineIndex],
          quantity: updatedLines[existingLineIndex].quantity + line.quantity,
        };
        return { lines: updatedLines };
      } else {
        // Add as new line
        const newLine: CartLine = {
          ...line,
          id: crypto.randomUUID(),
        };
        return { lines: [...state.lines, newLine] };
      }
    });
  },

  updateQuantity: (lineId, quantity) => {
    if (quantity <= 0) {
      get().removeLine(lineId);
      return;
    }
    set((state) => ({
      lines: state.lines.map((line) =>
        line.id === lineId ? { ...line, quantity } : line
      ),
    }));
  },

  removeLine: (lineId) => {
    set((state) => ({
      lines: state.lines.filter((line) => line.id !== lineId),
    }));
  },

  updateNotes: (lineId, notes) => {
    set((state) => ({
      lines: state.lines.map((line) =>
        line.id === lineId ? { ...line, notes } : line
      ),
    }));
  },

  clearCart: () => {
    set({ lines: [], basketVoucher: null, basketDiscount: null });
  },

  loadLines: (lines) => {
    set({ lines });
  },

  applyVoucher: (lineId, voucher) => {
    set((state) => ({
      lines: state.lines.map((line) =>
        line.id === lineId ? { ...line, voucher } : line
      ),
    }));
  },

  removeVoucher: (lineId) => {
    set((state) => ({
      lines: state.lines.map((line) =>
        line.id === lineId ? { ...line, voucher: undefined } : line
      ),
    }));
  },

  setBasketVoucher: (voucher) => {
    set({ basketVoucher: voucher });
  },

  clearBasketVoucher: () => {
    set({ basketVoucher: null });
  },

  setBasketDiscount: (discount) => {
    set({ basketDiscount: discount });
  },

  clearBasketDiscount: () => {
    set({ basketDiscount: null });
  },

  getSubtotal: () => {
    const { lines } = get();
    return lines.reduce((sum, line) => {
      const lineTotal = line.unit_price * line.quantity;
      const modifiersTotal =
        line.modifiers.reduce((modSum, mod) => modSum + mod.price_adjustment, 0) *
        line.quantity;
      const fullLineTotal = lineTotal + modifiersTotal;

      // Apply voucher discount if present
      if (line.voucher) {
        if (line.voucher.discountType === 'percentage') {
          return sum + (fullLineTotal * (1 - line.voucher.discountValue / 100));
        } else if (line.voucher.discountType === 'fixed') {
          return sum + Math.max(0, fullLineTotal - line.voucher.discountValue);
        } else if (line.voucher.discountType === 'free_item' || line.voucher.discountType === 'free_modifier') {
          return sum; // Free item - no cost
        }
      }

      return sum + fullLineTotal;
    }, 0);
  },

  getTaxTotal: () => {
    const { lines } = get();
    return lines.reduce((sum, line) => {
      const lineTotal = line.unit_price * line.quantity;
      const modifiersTotal =
        line.modifiers.reduce((modSum, mod) => modSum + mod.price_adjustment, 0) *
        line.quantity;
      const fullLineTotal = lineTotal + modifiersTotal;

      // Apply voucher discount if present
      let discountedTotal = fullLineTotal;
      if (line.voucher) {
        if (line.voucher.discountType === 'percentage') {
          discountedTotal = fullLineTotal * (1 - line.voucher.discountValue / 100);
        } else if (line.voucher.discountType === 'fixed') {
          discountedTotal = Math.max(0, fullLineTotal - line.voucher.discountValue);
        } else if (line.voucher.discountType === 'free_item' || line.voucher.discountType === 'free_modifier') {
          discountedTotal = 0; // Free item - no cost
        }
      }

      return sum + discountedTotal * line.tax_rate;
    }, 0);
  },

  getTotal: () => {
    const subtotal = get().getSubtotal();
    const tax = get().getTaxTotal();
    const voucherDiscount = get().getBasketVoucherDiscount();
    const discountAmount = get().getBasketDiscountAmount();
    return Math.max(0, subtotal + tax - voucherDiscount - discountAmount);
  },

  getBasketVoucherDiscount: () => {
    const { basketVoucher, lines } = get();
    if (!basketVoucher) return 0;
    const lineTotal = lines.reduce((sum, line) => {
      const lt = (line.unit_price + line.modifiers.reduce((s, m) => s + m.price_adjustment, 0)) * line.quantity;
      return sum + lt;
    }, 0);
    if (basketVoucher.discountType === 'fixed') return Math.min(basketVoucher.discountValue, lineTotal);
    if (basketVoucher.discountType === 'percentage') return lineTotal * (basketVoucher.discountValue / 100);
    return 0;
  },

  getBasketDiscountAmount: () => {
    const { basketDiscount, lines } = get();
    if (!basketDiscount) return 0;
    const lineTotal = lines.reduce((sum, line) => {
      const lt = (line.unit_price + line.modifiers.reduce((s, m) => s + m.price_adjustment, 0)) * line.quantity;
      return sum + lt;
    }, 0);
    if (basketDiscount.discountType === 'fixed') return Math.min(basketDiscount.discountValue, lineTotal);
    if (basketDiscount.discountType === 'percentage') return lineTotal * (basketDiscount.discountValue / 100);
    return 0;
  },

  getVoucherDiscountTotal: () => {
    const { lines } = get();
    return lines.reduce((sum, line) => {
      if (!line.voucher) return sum;

      const lineTotal = line.unit_price * line.quantity;
      const modifiersTotal =
        line.modifiers.reduce((modSum, mod) => modSum + mod.price_adjustment, 0) *
        line.quantity;
      const fullLineTotal = lineTotal + modifiersTotal;

      if (line.voucher.discountType === 'percentage') {
        return sum + (fullLineTotal * line.voucher.discountValue / 100);
      } else if (line.voucher.discountType === 'fixed') {
        return sum + line.voucher.discountValue;
      } else if (line.voucher.discountType === 'free_item' || line.voucher.discountType === 'free_modifier') {
        return sum + fullLineTotal;
      }
      return sum;
    }, 0);
  },
    }),
    {
      name: getStorageKey(), // localStorage key (user-scoped)
      storage: createJSONStorage(() => localStorage),
    }
  )
);
