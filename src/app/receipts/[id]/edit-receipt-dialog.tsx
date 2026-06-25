"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from "@penkey/ui";
import { Utensils, ShoppingBag, Users, Check, Hash, Save } from "lucide-react";
import { hapticButtonPress } from "@/lib/utils/haptics";
import { useScrollLock } from "@/hooks/use-scroll-lock";

interface EditReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { dining_option: string; customer_count: number; table_number: string | null }) => void;
  initialDiningOption: string;
  initialCustomerCount: number;
  initialTableNumber: string | null;
  saving?: boolean;
}

export function EditReceiptDialog({
  open,
  onClose,
  onSave,
  initialDiningOption,
  initialCustomerCount,
  initialTableNumber,
  saving = false,
}: EditReceiptDialogProps) {
  const [diningOption, setDiningOption] = useState<'eat-in' | 'takeaway'>(
    initialDiningOption === 'eat-in' ? 'eat-in' : 'takeaway'
  );
  const [customerCount, setCustomerCount] = useState<number>(initialCustomerCount || 1);
  const [tableNumber, setTableNumber] = useState<string>(initialTableNumber || "");

  useScrollLock(open);

  useEffect(() => {
    if (open) {
      setDiningOption(initialDiningOption === 'eat-in' ? 'eat-in' : 'takeaway');
      setCustomerCount(initialCustomerCount || 1);
      setTableNumber(initialTableNumber || "");
    }
  }, [open, initialDiningOption, initialCustomerCount, initialTableNumber]);

  const handleSave = () => {
    hapticButtonPress();
    onSave({
      dining_option: diningOption,
      customer_count: customerCount,
      table_number: tableNumber.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-[#3d3d3d] text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white text-center">
            Edit Order Details
          </DialogTitle>
          <p className="text-sm text-gray-400 text-center mt-2">
            Correct dining type, covers, or table number
          </p>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Dining Option */}
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
                data-selected={diningOption === 'eat-in'}
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
                data-selected={diningOption === 'takeaway'}
              >
                <ShoppingBag className="h-8 w-8" />
                <span className="text-lg font-bold">Takeaway</span>
              </button>
            </div>
          </div>

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
                  data-selected={customerCount === n}
                >
                  <span className="text-2xl font-bold">{n}</span>
                  <span className="text-xs">{n === 1 ? 'Person' : 'People'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Table Number */}
          <div>
            <div className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Table Number (optional)
            </div>
            <input
              type="text"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="e.g. Table 5"
              className="w-full px-4 py-3 bg-[#2d2d2d] text-white rounded-lg border border-gray-600 focus:border-penkey-orange focus:outline-none text-lg"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              size="lg"
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white h-12"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              className="flex-1 bg-penkey-orange hover:bg-penkey-orange/90 text-white h-12"
              onClick={handleSave}
              disabled={saving}
            >
              <Save className="h-5 w-5 mr-2" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
