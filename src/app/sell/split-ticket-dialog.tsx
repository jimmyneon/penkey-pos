"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, Button } from "@penkey/ui";
import { Split, Check, ShoppingCart } from "lucide-react";
import { formatCurrency } from "@penkey/ui";

interface CartLine {
  id: string;
  item_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
  modifiers: any[];
  notes: string;
  tax_rate: number;
}

interface SplitTicketDialogProps {
  open: boolean;
  onClose: () => void;
  lines: CartLine[];
  onSplit: (selectedLineIds: string[]) => void;
}

export function SplitTicketDialog({ open, onClose, lines, onSplit }: SplitTicketDialogProps) {
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());

  // Force unlock scroll when dialog closes
  useEffect(() => {
    if (!open) {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
    }
  }, [open]);

  const toggleLine = (lineId: string) => {
    const newSelected = new Set(selectedLineIds);
    if (newSelected.has(lineId)) {
      newSelected.delete(lineId);
    } else {
      newSelected.add(lineId);
    }
    setSelectedLineIds(newSelected);
  };

  const handleSplit = () => {
    if (selectedLineIds.size === 0 || selectedLineIds.size === lines.length) return;
    onSplit(Array.from(selectedLineIds));
    setSelectedLineIds(new Set());
    onClose();
  };

  const handleClose = () => {
    setSelectedLineIds(new Set());
    onClose();
  };

  const calculateTotal = (lineIds: Set<string>) => {
    return lines
      .filter(line => lineIds.has(line.id))
      .reduce((sum, line) => {
        const lineTotal = line.quantity * line.unit_price;
        const modifiersTotal = line.modifiers.reduce((modSum, mod) => modSum + (mod.price || 0), 0);
        return sum + lineTotal + modifiersTotal;
      }, 0);
  };

  const selectedTotal = calculateTotal(selectedLineIds);
  const remainingTotal = lines.reduce((sum, line) => {
    if (selectedLineIds.has(line.id)) return sum;
    const lineTotal = line.quantity * line.unit_price;
    const modifiersTotal = line.modifiers.reduce((modSum, mod) => modSum + (mod.price || 0), 0);
    return sum + lineTotal + modifiersTotal;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl bg-[#3d3d3d] text-white border-gray-700">
        <DialogTitle className="text-xl font-bold text-white">Split Ticket</DialogTitle>
        <DialogDescription className="text-gray-300">
          Select items to move to a new ticket
        </DialogDescription>

        <div className="max-h-[40vh] overflow-y-auto scrollbar-hide mt-4 space-y-2" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
          {lines.map((line) => {
            const isSelected = selectedLineIds.has(line.id);
            const lineTotal = line.quantity * line.unit_price;
            const modifiersTotal = line.modifiers.reduce((sum, mod) => sum + (mod.price || 0), 0);
            const total = lineTotal + modifiersTotal;

            return (
              <button
                key={line.id}
                onClick={() => toggleLine(line.id)}
                className={`w-full p-4 rounded-lg border-2 transition-colors text-left ${
                  isSelected
                    ? 'border-penkey-orange bg-penkey-orange/20'
                    : 'border-gray-700 hover:border-gray-600 bg-[#2d2d2d]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? 'border-penkey-orange bg-penkey-orange'
                        : 'border-gray-500'
                    }`}>
                      {isSelected && <Check className="h-4 w-4 text-white" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-white">
                        {line.item_name}
                        {line.variant_name && (
                          <span className="text-gray-400"> - {line.variant_name}</span>
                        )}
                      </div>
                      {line.modifiers.length > 0 && (
                        <div className="text-sm text-gray-400 mt-1">
                          {line.modifiers.map(mod => mod.name).join(', ')}
                        </div>
                      )}
                      {line.notes && (
                        <div className="text-sm text-gray-400 mt-1 italic">
                          Note: {line.notes}
                        </div>
                      )}
                      <div className="text-sm text-gray-400 mt-1">
                        Qty: {line.quantity} × {formatCurrency(line.unit_price)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="font-bold text-penkey-orange">
                      {formatCurrency(total)}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Summary */}
        <div className="border-t border-gray-700 pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">New Ticket Total:</span>
            <span className="font-bold text-penkey-orange">
              {formatCurrency(selectedTotal)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Remaining Ticket Total:</span>
            <span className="font-bold text-white">
              {formatCurrency(remainingTotal)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t border-gray-700">
          <Button
            onClick={handleClose}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSplit}
            disabled={selectedLineIds.size === 0 || selectedLineIds.size === lines.length}
            className="flex-1 bg-penkey-orange hover:bg-penkey-orange/90"
          >
            <Split className="h-4 w-4 mr-2" />
            Split Ticket ({selectedLineIds.size} items)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
