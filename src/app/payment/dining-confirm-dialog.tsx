"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from "@penkey/ui";
import { Utensils, ShoppingBag, Users, Check } from "lucide-react";
import { hapticButtonPress } from "@/lib/utils/haptics";
import { useScrollLock } from "@/hooks/use-scroll-lock";

interface DiningConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (diningOption: 'eat-in' | 'takeaway', customerCount: number) => void;
  initialDiningOption: 'eat-in' | 'takeaway';
  initialCustomerCount: number;
  isTableAssignment?: boolean;
}

export function DiningConfirmDialog({
  open,
  onClose,
  onConfirm,
  initialDiningOption,
  initialCustomerCount,
  isTableAssignment,
}: DiningConfirmDialogProps) {
  const [diningOption, setDiningOption] = useState<'eat-in' | 'takeaway'>(initialDiningOption);
  const [customerCount, setCustomerCount] = useState<number>(initialCustomerCount);

  useScrollLock(open);

  useEffect(() => {
    if (open) {
      setDiningOption(initialDiningOption);
      setCustomerCount(initialCustomerCount);
    }
  }, [open, initialDiningOption, initialCustomerCount]);

  const handleConfirm = () => {
    hapticButtonPress();
    onConfirm(diningOption, customerCount);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-[#3d3d3d] text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white text-center">
            Confirm Order Details
          </DialogTitle>
          <p className="text-sm text-gray-400 text-center mt-2">
            Please confirm before proceeding to payment
          </p>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Dining Option */}
          {!isTableAssignment && (
            <div>
              <div className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Utensils className="h-4 w-4" />
                Eating or Takeaway?
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { hapticButtonPress(); setDiningOption('eat-in'); }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg p-5 transition-all min-h-[100px] ${
                    diningOption === 'eat-in'
                      ? 'bg-penkey-orange text-white ring-2 ring-penkey-orange/50'
                      : 'bg-[#4d4d4d] hover:bg-[#5d5d5d] text-gray-300'
                  }`}
                >
                  <Utensils className="h-8 w-8" />
                  <span className="text-lg font-bold">Eat In</span>
                </button>
                <button
                  onClick={() => { hapticButtonPress(); setDiningOption('takeaway'); }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg p-5 transition-all min-h-[100px] ${
                    diningOption === 'takeaway'
                      ? 'bg-penkey-orange text-white ring-2 ring-penkey-orange/50'
                      : 'bg-[#4d4d4d] hover:bg-[#5d5d5d] text-gray-300'
                  }`}
                >
                  <ShoppingBag className="h-8 w-8" />
                  <span className="text-lg font-bold">Takeaway</span>
                </button>
              </div>
            </div>
          )}

          {/* Customer Count */}
          <div>
            <div className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              How many people?
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => { hapticButtonPress(); setCustomerCount(n); }}
                  className={`flex flex-col items-center justify-center rounded-lg py-3 transition-all ${
                    customerCount === n
                      ? 'bg-penkey-orange text-white ring-2 ring-penkey-orange/50'
                      : 'bg-[#4d4d4d] hover:bg-[#5d5d5d] text-gray-300'
                  }`}
                >
                  <span className="text-2xl font-bold">{n}</span>
                  <span className="text-xs">{n === 1 ? 'Person' : 'People'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-[#2d2d2d] rounded-lg p-4 border border-gray-600">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Dining:</span>
              <span className="font-semibold text-white">
                {isTableAssignment ? 'Eat In (Table)' : diningOption === 'eat-in' ? 'Eat In' : 'Takeaway'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-400">People:</span>
              <span className="font-semibold text-white">
                {customerCount} {customerCount === 1 ? 'person' : 'people'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              size="lg"
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white h-12"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              className="flex-1 bg-penkey-orange hover:bg-penkey-orange/90 text-white h-12"
              onClick={handleConfirm}
            >
              <Check className="h-5 w-5 mr-2" />
              Confirm
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
