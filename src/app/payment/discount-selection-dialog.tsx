"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from "@penkey/ui";
import { formatCurrency } from "@penkey/ui";
import { Percent, Ticket, X, Loader2, Tag } from "lucide-react";
import { hapticButtonPress } from "@/lib/utils/haptics";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import type { BasketDiscount } from "@/lib/store/cart-store";

interface DiscountSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (discount: BasketDiscount) => void;
  onRemove: () => void;
  orderTotal: number;
  currentDiscount: BasketDiscount | null;
}

export function DiscountSelectionDialog({
  open,
  onClose,
  onApply,
  onRemove,
  orderTotal,
  currentDiscount,
}: DiscountSelectionDialogProps) {
  const [mode, setMode] = useState<'select' | 'enter-code'>('select');
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useScrollLock(open);

  useEffect(() => {
    if (open) {
      setMode('select');
      setError(null);
      setCodeInput("");
      fetchDiscounts();
    }
  }, [open]);

  const fetchDiscounts = async () => {
    setLoading(true);
    try {
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      const res = await fetch("/api/discounts?active=true", {
        headers: sessionData ? { "x-pos-session": sessionData } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setDiscounts(data.discounts || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDiscount = (discount: any) => {
    hapticButtonPress();
    const discountAmount = calculateAmount(discount, orderTotal);
    onApply({
      id: discount.id,
      code: discount.code || discount.name,
      name: discount.name,
      discountType: discount.type,
      discountValue: parseFloat(discount.value),
      discountAmount,
    });
    onClose();
  };

  const handleValidateCode = async () => {
    if (!codeInput.trim()) return;
    setValidating(true);
    setError(null);
    try {
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      const res = await fetch("/api/discounts/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionData ? { "x-pos-session": sessionData } : {}),
        },
        body: JSON.stringify({ code: codeInput, order_amount: orderTotal, channel: 'pos' }),
      });
      const data = await res.json();
      if (data.valid && data.discount) {
        hapticButtonPress();
        onApply({
          id: data.discount.id,
          code: data.discount.code,
          name: data.discount.name,
          discountType: data.discount.discount_type,
          discountValue: data.discount.discount_value,
          discountAmount: data.discount.discount_amount,
        });
        setCodeInput("");
        onClose();
      } else {
        setError(data.error || "Invalid discount code");
      }
    } catch {
      setError("Failed to validate code");
    } finally {
      setValidating(false);
    }
  };

  const calculateAmount = (discount: any, total: number): number => {
    const dtype = discount.type || discount.discount_type;
    const dvalue = parseFloat(discount.value ?? discount.discount_value ?? 0);
    if (dtype === 'percentage') {
      let amount = total * (dvalue / 100);
      if (discount.max_discount_amount) {
        amount = Math.min(amount, parseFloat(discount.max_discount_amount));
      }
      return amount;
    }
    if (dtype === 'fixed' || dtype === 'fixed_amount') {
      return Math.min(dvalue, total);
    }
    return 0;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-[#3d3d3d] text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Apply Discount
          </DialogTitle>
        </DialogHeader>

        {/* Current discount */}
        {currentDiscount && (
          <div className="bg-green-900/20 border border-green-600/50 rounded-lg p-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-green-400">Current Discount</div>
              <div className="text-xs text-gray-300">
                {currentDiscount.name} ({currentDiscount.code})
              </div>
              <div className="text-sm text-white mt-1">
                −{formatCurrency(currentDiscount.discountAmount)}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-red-500/50 text-red-400 hover:bg-red-900/30"
              onClick={() => { hapticButtonPress(); onRemove(); onClose(); }}
            >
              <X className="h-4 w-4" /> Remove
            </Button>
          </div>
        )}

        {/* Mode toggle */}
        <div className="flex gap-2 bg-[#2d2d2d] rounded-lg p-1">
          <button
            onClick={() => { setMode('select'); setError(null); }}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${
              mode === 'select' ? 'bg-penkey-orange text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Select from list
          </button>
          <button
            onClick={() => { setMode('enter-code'); setError(null); }}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${
              mode === 'enter-code' ? 'bg-penkey-orange text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Enter code
          </button>
        </div>

        {/* Select mode */}
        {mode === 'select' && (
          <div className="space-y-2 mt-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 text-penkey-orange animate-spin" />
              </div>
            ) : discounts.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Ticket className="h-12 w-12 mx-auto mb-2 text-gray-600" />
                <p className="text-sm">No active discounts available</p>
              </div>
            ) : (
              discounts.map((discount) => {
                const amount = calculateAmount(discount, orderTotal);
                return (
                  <button
                    key={discount.id}
                    onClick={() => handleSelectDiscount(discount)}
                    className="w-full bg-[#4d4d4d] hover:bg-[#5d5d5d] rounded-lg p-4 text-left transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-white">{discount.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Code: {discount.code || '—'}
                        </div>
                        {discount.description && (
                          <div className="text-xs text-gray-500 mt-1">{discount.description}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-penkey-orange">
                          {(discount.type || discount.discount_type) === 'percentage'
                            ? `${parseFloat(discount.value ?? discount.discount_value)}%`
                            : formatCurrency(parseFloat(discount.value ?? discount.discount_value))}
                        </div>
                        <div className="text-xs text-green-400">
                          −{formatCurrency(amount)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Enter code mode */}
        {mode === 'enter-code' && (
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Discount Code</label>
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleValidateCode()}
                placeholder="e.g. SUMMER10"
                className="w-full bg-[#2d2d2d] border border-gray-600 rounded-lg px-4 py-3 text-white text-lg font-mono uppercase tracking-wider focus:outline-none focus:border-penkey-orange"
                autoFocus
              />
            </div>
            {error && (
              <div className="text-sm text-red-400 bg-red-900/20 rounded-lg p-2">{error}</div>
            )}
            <Button
              size="lg"
              className="w-full bg-penkey-orange hover:bg-penkey-orange/90 text-white h-12"
              onClick={handleValidateCode}
              disabled={!codeInput.trim() || validating}
            >
              {validating ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Validating...</>
              ) : (
                <><Tag className="h-5 w-5 mr-2" /> Apply Code</>
              )}
            </Button>
          </div>
        )}

        {/* Cancel */}
        <Button
          size="lg"
          variant="outline"
          className="w-full border-gray-500 text-gray-300 hover:bg-gray-600 hover:text-white h-12 mt-2"
          onClick={onClose}
        >
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
