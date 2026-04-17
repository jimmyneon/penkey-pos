"use client";

import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from "@penkey/ui";
import { Plus, Minus, User, Hash, Trash2 } from "lucide-react";
import { formatCurrency } from "@penkey/ui";
import { hapticButtonPress, hapticDelete, hapticSuccess } from "@/lib/utils/haptics";
import { useScrollLock } from "@/hooks/use-scroll-lock";

interface CartLine {
  id: string;
  item_id: string;
  item_name: string;
  variant_id: string | null;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
  modifiers: Array<{
    id: string;
    name: string;
    price_adjustment: number;
  }>;
  notes: string;
  tax_rate: number;
}

interface TicketModalProps {
  open: boolean;
  onClose: () => void;
  lines: CartLine[];
  updateQuantity: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  getSubtotal: () => number;
  getTaxTotal: () => number;
  getTotal: () => number;
  onCheckout: () => void;
  onSave: () => void;
  onClearAll: () => void;
  ticketAssignment?: { type: 'customer' | 'table'; name: string } | null;
}

export function TicketModal({
  open,
  onClose,
  lines,
  updateQuantity,
  removeLine,
  getSubtotal,
  getTaxTotal,
  getTotal,
  onCheckout,
  onSave,
  onClearAll,
  ticketAssignment,
}: TicketModalProps) {
  // Use scroll lock hook to manage scroll state
  useScrollLock(open);

  // Track previous lines length to detect transition from items to empty
  const prevLinesLength = useRef(lines.length);

  // Auto-close modal when all items are deleted (transition from items to empty)
  useEffect(() => {
    if (open && prevLinesLength.current > 0 && lines.length === 0) {
      onClose();
    }
    prevLinesLength.current = lines.length;
  }, [lines.length, open, onClose]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#3d3d3d] text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-white">Current Ticket</DialogTitle>
        </DialogHeader>

        {/* Assignment Info */}
        {ticketAssignment && (
          <div className="bg-[#2d2d2d] border border-gray-700 rounded-lg px-3 py-2 flex items-center gap-2">
            {ticketAssignment.type === 'customer' ? (
              <User className="h-4 w-4 text-penkey-orange" />
            ) : (
              <Hash className="h-4 w-4 text-penkey-orange" />
            )}
            <span className="text-white text-sm font-medium">
              {ticketAssignment.name}
            </span>
          </div>
        )}

        {/* Scrollable Items Only */}
        <div className="max-h-[40vh] overflow-y-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
          {lines.length > 0 ? (
            <div className="space-y-3">
              {lines.map((line) => (
                <div
                  key={line.id}
                  className="bg-[#2d2d2d] rounded-lg p-4 border border-gray-700"
                >
                  <div className="mb-3">
                    <h4 className="font-semibold text-white text-sm sm:text-base">
                      {line.item_name}
                    </h4>
                    {line.variant_name && (
                      <p className="text-xs sm:text-sm text-gray-400">
                        {line.variant_name}
                      </p>
                    )}
                    {line.modifiers.length > 0 && (
                      <p className="text-xs sm:text-sm text-gray-400">
                        {line.modifiers.map((m) => m.name).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <button
                        onClick={() => {
                          hapticButtonPress();
                          updateQuantity(line.id, line.quantity - 1);
                        }}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-md bg-[#4d4d4d] border-2 border-gray-600 flex items-center justify-center hover:bg-[#5d5d5d] text-white"
                      >
                        <Minus className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                      <span className="w-10 sm:w-12 text-center font-bold text-base sm:text-lg text-white">
                        {line.quantity}
                      </span>
                      <button
                        onClick={() => {
                          hapticButtonPress();
                          updateQuantity(line.id, line.quantity + 1);
                        }}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-md bg-[#4d4d4d] border-2 border-gray-600 flex items-center justify-center hover:bg-[#5d5d5d] text-white"
                      >
                        <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                    </div>
                    <span className="font-bold text-lg sm:text-xl text-penkey-orange">
                      {formatCurrency((line.unit_price + line.modifiers.reduce((sum, m) => sum + m.price_adjustment, 0)) * line.quantity)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No items in ticket</p>
            </div>
          )}
        </div>

        {/* Clear All Button */}
        {lines.length > 0 && (
          <div className="pt-3">
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                hapticDelete();
                onClearAll();
              }}
              className="w-full bg-red-600 hover:bg-red-700 text-white border-0 active:scale-95 transition-transform"
            >
              <Trash2 className="h-5 w-5 mr-2" />
              Clear All Items
            </Button>
          </div>
        )}

        {/* Fixed Totals - Always Visible */}
        {lines.length > 0 && (
          <div className="border-t border-gray-700 pt-4 mt-4 space-y-2">
              <div className="flex justify-between text-base">
                <span className="text-gray-400">Subtotal</span>
                <span className="font-semibold text-white">{formatCurrency(getSubtotal())}</span>
              </div>
              <div className="flex justify-between text-base">
                <span className="text-gray-400">Tax (20%)</span>
                <span className="font-semibold text-white">{formatCurrency(getTaxTotal())}</span>
              </div>
              <div className="flex justify-between text-2xl font-bold border-t border-gray-700 pt-3">
                <span className="text-white">Total</span>
                <span className="text-penkey-orange">{formatCurrency(getTotal())}</span>
              </div>
            </div>
        )}

        {/* Fixed Action Buttons - Always Visible */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              size="lg"
              variant="outline"
              className="flex-1 w-full"
              disabled={lines.length === 0}
              onClick={() => {
                onClose();
                onSave();
              }}
            >
              Save Ticket
            </Button>
            <Button
              size="lg"
              className="flex-1 w-full bg-penkey-orange hover:bg-penkey-orange/90"
              disabled={lines.length === 0}
              onClick={() => {
                hapticSuccess();
                onClose();
                onCheckout();
              }}
            >
              Charge {formatCurrency(getTotal())}
            </Button>
          </div>
      </DialogContent>
    </Dialog>
  );
}
