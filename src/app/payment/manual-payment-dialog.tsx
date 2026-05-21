"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@penkey/ui";
import { Banknote, CreditCard } from "lucide-react";

interface ManualPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (method: "cash" | "card") => void;
}

export function ManualPaymentDialog({ open, onClose, onConfirm }: ManualPaymentDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<"cash" | "card" | null>(null);

  const handleConfirm = () => {
    if (selectedMethod) {
      onConfirm(selectedMethod);
      setSelectedMethod(null);
    }
  };

  const handleClose = () => {
    setSelectedMethod(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-[#3d3d3d] text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white">
            Manual Payment
          </DialogTitle>
          <p className="text-sm text-gray-400 mt-2">
            Record payment without processing. Select the method used:
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-6">
          {/* Cash Option */}
          <button
            onClick={() => setSelectedMethod("cash")}
            className={`bg-[#5d5d5d] hover:bg-[#6d6d6d] text-white rounded-lg p-8 flex flex-col items-center justify-center gap-4 transition-all min-h-[160px] ${
              selectedMethod === "cash" ? "ring-4 ring-penkey-orange" : ""
            }`}
          >
            <Banknote className="h-12 w-12" />
            <span className="text-xl font-bold">Cash</span>
          </button>

          {/* Card Option */}
          <button
            onClick={() => setSelectedMethod("card")}
            className={`bg-[#5d5d5d] hover:bg-[#6d6d6d] text-white rounded-lg p-8 flex flex-col items-center justify-center gap-4 transition-all min-h-[160px] ${
              selectedMethod === "card" ? "ring-4 ring-penkey-orange" : ""
            }`}
          >
            <CreditCard className="h-12 w-12" />
            <span className="text-xl font-bold">Card</span>
          </button>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleClose}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white rounded-lg py-3 px-6 text-lg font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedMethod}
            className="flex-1 bg-penkey-orange hover:bg-orange-600 disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-3 px-6 text-lg font-semibold transition-colors"
          >
            Confirm
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
