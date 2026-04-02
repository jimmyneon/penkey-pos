"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from "@penkey/ui";
import { Delete } from "lucide-react";

interface PriceInputDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (price: number) => void;
  itemName: string;
}

export function PriceInputDialog({ open, onClose, onConfirm, itemName }: PriceInputDialogProps) {
  const [price, setPrice] = useState("");

  // Force unlock scroll when dialog closes
  useEffect(() => {
    if (!open) {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
    }
  }, [open]);

  const handleNumberClick = (num: string) => {
    if (num === "." && price.includes(".")) return;
    if (price.split(".")[1]?.length >= 2) return; // Max 2 decimal places
    setPrice(price + num);
  };

  const handleBackspace = () => {
    setPrice(price.slice(0, -1));
  };

  const handleClear = () => {
    setPrice("");
  };

  const handleConfirm = () => {
    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue <= 0) {
      alert("Please enter a valid price");
      return;
    }
    onConfirm(priceValue);
    setPrice("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-[#3d3d3d] text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">Enter Price</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-400 mb-2">Item: {itemName}</p>
            <div className="bg-[#2d2d2d] border border-gray-600 rounded-lg p-4 text-right">
              <div className="text-xs text-gray-400 mb-1">PRICE</div>
              <div className="text-4xl font-bold text-penkey-orange">
                £{price || "0.00"}
              </div>
            </div>
          </div>

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num)}
                className="bg-[#4d4d4d] hover:bg-[#5d5d5d] text-white text-2xl font-semibold py-4 rounded-lg transition-colors"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClear}
              className="bg-red-900/30 hover:bg-red-900/50 text-red-400 text-lg font-semibold py-4 rounded-lg transition-colors"
            >
              C
            </button>
            <button
              onClick={() => handleNumberClick("0")}
              className="bg-[#4d4d4d] hover:bg-[#5d5d5d] text-white text-2xl font-semibold py-4 rounded-lg transition-colors"
            >
              0
            </button>
            <button
              onClick={() => handleNumberClick(".")}
              className="bg-[#4d4d4d] hover:bg-[#5d5d5d] text-white text-2xl font-semibold py-4 rounded-lg transition-colors"
            >
              .
            </button>
          </div>

          <button
            onClick={handleBackspace}
            className="w-full bg-[#4d4d4d] hover:bg-[#5d5d5d] text-white py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Delete className="h-5 w-5" />
            <span>Backspace</span>
          </button>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              size="lg"
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              className="flex-1 bg-penkey-orange hover:bg-penkey-orange/90"
              onClick={handleConfirm}
              disabled={!price || parseFloat(price) <= 0}
            >
              Add to Ticket
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
