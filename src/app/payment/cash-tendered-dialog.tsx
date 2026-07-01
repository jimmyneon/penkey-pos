"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Button } from "@penkey/ui";
import { formatCurrency } from "@penkey/ui";
import { Banknote, Percent } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { hapticButtonPress } from "@/lib/utils/haptics";
import { DiscountSelectionDialog } from "./discount-selection-dialog";
import type { BasketDiscount } from "@/lib/store/cart-store";

interface CashTenderedDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => void;
  totalDue: number;
  cartTotal: number;
  basketDiscount: BasketDiscount | null;
  onApplyDiscount: (discount: BasketDiscount) => void;
  onRemoveDiscount: () => void;
  getBasketDiscountAmount: () => number;
}

export function CashTenderedDialog({ open, onClose, onConfirm, totalDue, cartTotal, basketDiscount, onApplyDiscount, onRemoveDiscount, getBasketDiscountAmount }: CashTenderedDialogProps) {
  const { showToast } = useToast();
  const [cashTendered, setCashTendered] = useState("");
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);

  useEffect(() => {
    if (open) {
      return () => {
        document.body.style.overflow = '';
        document.body.style.pointerEvents = '';
      };
    } else {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
    }
  }, [open]);

  const tenderedAmount = (parseFloat(cashTendered) || 0) / 100;
  const change = tenderedAmount - totalDue;
  const canComplete = tenderedAmount >= totalDue;

  const handleNumberClick = (num: string) => {
    if (num === "00") {
      setCashTendered(cashTendered + "00");
    } else {
      setCashTendered(cashTendered + num);
    }
  };

  const handleClear = () => {
    setCashTendered("");
  };

  const handleQuickCash = (amount: number) => {
    const newAmount = amount * 100; // Convert to pence
    setCashTendered(newAmount.toString());
  };

  const handleConfirm = () => {
    if (!canComplete) {
      showToast("Insufficient amount tendered", "error");
      return;
    }
    onConfirm(tenderedAmount);
    setCashTendered("");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col overflow-hidden bg-[#3d3d3d] text-white border-gray-700 p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl font-bold text-white">Cash Payment</DialogTitle>
          <DialogDescription className="text-gray-400">Enter the amount of cash tendered by the customer</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 py-2">
          {/* Total Due + Discount */}
          <div className="bg-[#2d2d2d] border border-gray-600 rounded-lg p-2.5">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-gray-400">TOTAL DUE</div>
              {basketDiscount && (
                <button
                  onClick={() => { hapticButtonPress(); setDiscountDialogOpen(true); }}
                  className="text-xs bg-green-600/30 text-green-400 px-2 py-0.5 rounded font-semibold hover:bg-green-600/40"
                >
                  {basketDiscount.code} −{formatCurrency(getBasketDiscountAmount())}
                </button>
              )}
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white">{formatCurrency(totalDue)}</div>
            {basketDiscount && (
              <div className="text-xs text-gray-500 mt-1">
                Subtotal: {formatCurrency(cartTotal)} | Discount: −{formatCurrency(getBasketDiscountAmount())}
              </div>
            )}
          </div>

          {/* Discount Button (when no discount applied) */}
          {!basketDiscount && (
            <button
              onClick={() => { hapticButtonPress(); setDiscountDialogOpen(true); }}
              className="w-full bg-[#4d4d4d] hover:bg-[#5d5d5d] text-gray-300 rounded-lg py-2 px-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Percent className="h-4 w-4" />
              Add Discount Code
            </button>
          )}

          {/* Cash Tendered + Change - side by side */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#2d2d2d] border border-gray-600 rounded-lg p-2.5">
              <div className="text-xs text-gray-400 mb-1">CASH TENDERED</div>
              <div className="text-2xl sm:text-3xl font-bold text-penkey-orange">
                {formatCurrency(tenderedAmount)}
              </div>
            </div>
            <div className="bg-[#2d2d2d] border border-gray-600 rounded-lg p-2.5">
              <div className="text-xs text-gray-400 mb-1">CHANGE</div>
              <div className={`text-2xl sm:text-3xl font-bold ${
                tenderedAmount === 0 ? 'text-gray-500' : 
                change >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {tenderedAmount === 0 ? '£0.00' : 
                 change >= 0 ? formatCurrency(change) : 'Insufficient'}
              </div>
            </div>
          </div>

          {/* Quick Cash Buttons */}
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 20, 50].map((amount) => (
              <button
                key={amount}
                onClick={() => handleQuickCash(amount)}
                className="h-10 bg-[#4d4d4d] hover:bg-[#5d5d5d] active:bg-[#6d6d6d] text-white rounded-lg text-sm font-semibold transition-colors"
              >
                £{amount}
              </button>
            ))}
          </div>

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num)}
                className="h-11 sm:h-12 bg-[#4d4d4d] hover:bg-[#5d5d5d] active:bg-[#6d6d6d] text-white rounded-lg text-lg sm:text-xl font-semibold transition-colors"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClear}
              className="h-11 sm:h-12 bg-red-900/30 hover:bg-red-900/50 active:bg-red-900/60 text-red-400 rounded-lg text-sm font-semibold transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => handleNumberClick("0")}
              className="h-11 sm:h-12 bg-[#4d4d4d] hover:bg-[#5d5d5d] active:bg-[#6d6d6d] text-white rounded-lg text-lg sm:text-xl font-semibold transition-colors"
            >
              0
            </button>
            <button
              onClick={() => handleNumberClick("00")}
              className="h-11 sm:h-12 bg-[#4d4d4d] hover:bg-[#5d5d5d] active:bg-[#6d6d6d] text-white rounded-lg text-lg sm:text-xl font-semibold transition-colors"
            >
              00
            </button>
          </div>
        </div>

        {/* Action Buttons - pinned at bottom, always visible */}
        <div className="flex-shrink-0 flex gap-2 pt-2 border-t border-gray-700">
          <Button
            size="lg"
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white h-12"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            size="lg"
            className="flex-1 bg-penkey-orange hover:bg-penkey-orange/90 disabled:bg-gray-600 h-12"
            onClick={handleConfirm}
            disabled={!canComplete}
          >
            <Banknote className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
            <span className="text-sm sm:text-base">Complete</span>
          </Button>
        </div>
      </DialogContent>

      <DiscountSelectionDialog
        open={discountDialogOpen}
        onClose={() => setDiscountDialogOpen(false)}
        onApply={(discount: BasketDiscount) => {
          onApplyDiscount(discount);
          showToast(`Discount "${discount.code}" applied`, 'success');
        }}
        onRemove={() => {
          onRemoveDiscount();
          showToast('Discount removed', 'info');
        }}
        orderTotal={cartTotal}
        currentDiscount={basketDiscount}
      />
    </Dialog>
  );
}
