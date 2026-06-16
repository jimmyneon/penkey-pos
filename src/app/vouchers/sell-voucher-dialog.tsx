"use client";

import { useState } from "react";
import { X, ShoppingCart, DollarSign } from "lucide-react";

interface SellVoucherDialogProps {
  open: boolean;
  onClose: () => void;
  onAddToBasket: (amount: number, recipientName: string) => void;
}

const PRESETS = [5, 10, 20, 25, 50, 100];

export function SellVoucherDialog({ open, onClose, onAddToBasket }: SellVoucherDialogProps) {
  const [amount, setAmount] = useState("");
  const [recipientName, setRecipientName] = useState("");

  if (!open) return null;

  const handleAdd = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    onAddToBasket(val, recipientName.trim());
    setAmount("");
    setRecipientName("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#3d3d3d] rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-penkey-orange" />
            <h2 className="text-lg font-bold text-white">Sell Gift Voucher</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-2">Voucher Value</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-bold text-penkey-orange">£</span>
              <input
                type="number" min="1" step="0.01"
                value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-[#2d2d2d] text-white pl-8 pr-4 py-3 rounded-lg border border-gray-600 focus:outline-none focus:border-penkey-orange text-xl font-bold"
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {PRESETS.map((v) => (
                <button key={v} onClick={() => setAmount(String(v))}
                  className={`py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    amount === String(v)
                      ? "border-penkey-orange bg-penkey-orange/10 text-penkey-orange"
                      : "border-gray-600 bg-[#2d2d2d] text-gray-300 hover:border-gray-400"
                  }`}>
                  £{v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-2">Recipient Name (optional)</label>
            <input
              type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="w-full bg-[#2d2d2d] text-white px-4 py-3 rounded-lg border border-gray-600 focus:outline-none focus:border-penkey-orange"
            />
          </div>

          <p className="text-xs text-gray-500">
            This adds the voucher to the basket. After payment, create the voucher from the Gift Vouchers page.
          </p>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 bg-[#2d2d2d] hover:bg-[#4d4d4d] text-white rounded-lg font-semibold border border-gray-600">
            Cancel
          </button>
          <button onClick={handleAdd} disabled={!amount || parseFloat(amount) <= 0}
            className="flex-1 py-3 bg-penkey-orange hover:bg-penkey-orange/90 disabled:opacity-40 text-white rounded-lg font-semibold flex items-center justify-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Add to Basket
          </button>
        </div>
      </div>
    </div>
  );
}
