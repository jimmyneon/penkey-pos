"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Button } from "@penkey/ui";
import { formatCurrency } from "@penkey/ui";
import { Banknote } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";

interface CashTenderedDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => void;
  totalDue: number;
}

export function CashTenderedDialog({ open, onClose, onConfirm, totalDue }: CashTenderedDialogProps) {
  const { showToast } = useToast();
  const [cashTendered, setCashTendered] = useState("");

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

  const tenderedAmount = parseFloat(cashTendered) || 0;
  const change = tenderedAmount - totalDue;
  const canComplete = tenderedAmount >= totalDue;

  const handleNumberClick = (num: string) => {
    if (num === "." && cashTendered.includes(".")) return;
    if (cashTendered.split(".")[1]?.length >= 2) return; // Max 2 decimal places
    setCashTendered(cashTendered + num);
  };

  const handleClear = () => {
    setCashTendered("");
  };

  const handleQuickCash = (amount: number) => {
    const currentAmount = parseFloat(cashTendered) || 0;
    const newAmount = currentAmount + amount;
    setCashTendered(newAmount.toFixed(2));
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-[#3d3d3d] text-white border-gray-700 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl font-bold text-white">Cash Payment</DialogTitle>
          <DialogDescription className="text-gray-400">Enter the amount of cash tendered by the customer</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Total Due */}
          <div className="bg-[#2d2d2d] border border-gray-600 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">TOTAL DUE</div>
            <div className="text-2xl sm:text-3xl font-bold text-white">{formatCurrency(totalDue)}</div>
          </div>

          {/* Cash Tendered Display */}
          <div className="bg-[#2d2d2d] border border-gray-600 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">CASH TENDERED</div>
            <div className="text-3xl sm:text-4xl font-bold text-penkey-orange">
              £{cashTendered || "0.00"}
            </div>
          </div>

          {/* Change Display */}
          <div className="bg-[#2d2d2d] border border-gray-600 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">CHANGE</div>
            <div className={`text-2xl sm:text-3xl font-bold ${
              tenderedAmount === 0 ? 'text-gray-500' : 
              change >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {tenderedAmount === 0 ? '£0.00' : 
               change >= 0 ? formatCurrency(change) : 'Insufficient'}
            </div>
          </div>

          {/* Quick Cash Buttons */}
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 20, 50].map((amount) => (
              <button
                key={amount}
                onClick={() => handleQuickCash(amount)}
                className="h-10 sm:h-12 bg-[#4d4d4d] hover:bg-[#5d5d5d] active:bg-[#6d6d6d] text-white rounded-lg text-sm font-semibold transition-colors"
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
                className="h-12 sm:h-14 bg-[#4d4d4d] hover:bg-[#5d5d5d] active:bg-[#6d6d6d] text-white rounded-lg text-xl sm:text-2xl font-semibold transition-colors"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClear}
              className="h-12 sm:h-14 bg-red-900/30 hover:bg-red-900/50 active:bg-red-900/60 text-red-400 rounded-lg text-sm font-semibold transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => handleNumberClick("0")}
              className="h-12 sm:h-14 bg-[#4d4d4d] hover:bg-[#5d5d5d] active:bg-[#6d6d6d] text-white rounded-lg text-xl sm:text-2xl font-semibold transition-colors"
            >
              0
            </button>
            <button
              onClick={() => handleNumberClick(".")}
              className="h-12 sm:h-14 bg-[#4d4d4d] hover:bg-[#5d5d5d] active:bg-[#6d6d6d] text-white rounded-lg text-xl sm:text-2xl font-semibold transition-colors"
            >
              .
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
