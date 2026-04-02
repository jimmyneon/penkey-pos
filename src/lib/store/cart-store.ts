import { create } from "zustand";

export interface CartModifier {
  id: string;
  name: string;
  price_adjustment: number;
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
}

interface CartStore {
  lines: CartLine[];
  addLine: (line: Omit<CartLine, "id">) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  updateNotes: (lineId: string, notes: string) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTaxTotal: () => number;
  getTotal: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  lines: [],

  addLine: (line) => {
    const newLine: CartLine = {
      ...line,
      id: crypto.randomUUID(),
    };
    set((state) => ({ lines: [...state.lines, newLine] }));
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
    set({ lines: [] });
  },

  getSubtotal: () => {
    const { lines } = get();
    return lines.reduce((sum, line) => {
      const lineTotal = line.unit_price * line.quantity;
      const modifiersTotal =
        line.modifiers.reduce((modSum, mod) => modSum + mod.price_adjustment, 0) *
        line.quantity;
      return sum + lineTotal + modifiersTotal;
    }, 0);
  },

  getTaxTotal: () => {
    const { lines } = get();
    return lines.reduce((sum, line) => {
      const lineTotal = line.unit_price * line.quantity;
      const modifiersTotal =
        line.modifiers.reduce((modSum, mod) => modSum + mod.price_adjustment, 0) *
        line.quantity;
      return sum + (lineTotal + modifiersTotal) * line.tax_rate;
    }, 0);
  },

  getTotal: () => {
    return get().getSubtotal() + get().getTaxTotal();
  },
}));
