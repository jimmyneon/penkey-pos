"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@penkey/ui";
import { Plus, Minus, User, Hash, Trash2, Printer, Save, X } from "lucide-react";
import { formatCurrency } from "@penkey/ui";
import { hapticButtonPress, hapticDelete, hapticSuccess } from "@/lib/utils/haptics";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { usePullToDismiss } from "@/hooks/use-pull-to-dismiss";

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
  voucher?: {
    id: string;
    name: string;
    discountType: string;
    discountValue: number;
  };
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
  getBasketVoucherDiscount?: () => number;
  onCheckout: () => void;
  onSave: () => void;
  onClearAll: () => void;
  onPrint: () => void;
  ticketAssignment?: { type: 'customer' | 'table'; name: string; customer?: any } | null;
  onCustomerClick?: (customer: any) => void;
  basketVoucher?: { id: string; name: string; discountType: string; discountValue: number } | null;
  hideVoucherDisplay?: boolean;
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
  getBasketVoucherDiscount,
  onCheckout,
  onSave,
  onClearAll,
  onPrint,
  ticketAssignment,
  onCustomerClick,
  basketVoucher,
  hideVoucherDisplay = false,
}: TicketModalProps) {
  // Use scroll lock hook to manage scroll state
  useScrollLock(open);

  const [visible, setVisible] = useState(false);

  const { dragOffset, isDragging, handlers: pullHandlers } = usePullToDismiss({
    onDismiss: onClose,
    threshold: 100,
  });

  // Track previous lines length to detect transition from items to empty
  const prevLinesLength = useRef(lines.length);

  // Auto-close modal when all items are deleted (transition from items to empty)
  useEffect(() => {
    if (open && prevLinesLength.current > 0 && lines.length === 0) {
      onClose();
    }
    prevLinesLength.current = lines.length;
  }, [lines.length, open, onClose]);

  // Trigger slide-up animation
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`} />

      {/* Slide-up panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: isDragging ? `translateY(${dragOffset}px)` : undefined,
          transition: isDragging ? 'none' : undefined,
        }}
        className={`relative w-full bg-[#3d3d3d] text-white rounded-t-2xl border-t border-gray-700 shadow-2xl transition-transform duration-300 ease-out ${visible ? 'translate-y-0' : 'translate-y-full'} max-h-[90vh] flex flex-col`}
      >
        {/* Drag zone - pull-to-dismiss only works here, not in scrollable content */}
        <div {...pullHandlers}>
          {/* Drag handle */}
          <div className="flex justify-center pt-2 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing">
            <div className="w-10 h-1 bg-gray-600 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Current Ticket</h2>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Assignment Info */}
        {ticketAssignment && (
          <div className="bg-[#2d2d2d] border border-gray-700 rounded-lg px-3 py-2 flex items-center gap-2">
            {ticketAssignment.type === 'customer' ? (
              <User className="h-4 w-4 text-penkey-orange" />
            ) : (
              <Hash className="h-4 w-4 text-penkey-orange" />
            )}
            {ticketAssignment.type === 'customer' && onCustomerClick && ticketAssignment.customer ? (
              <button
                onClick={() => {
                  console.log("[TicketModal] Customer button clicked, customer:", ticketAssignment.customer);
                  onCustomerClick(ticketAssignment.customer);
                }}
                className="text-white text-sm font-medium hover:text-penkey-orange transition-colors flex items-center gap-1"
              >
                {ticketAssignment.name}
                <span className="text-xs text-gray-400">(click for details)</span>
              </button>
            ) : (
              <span className="text-white text-sm font-medium">
                {ticketAssignment.name}
              </span>
            )}
          </div>
        )}

        {/* Scrollable Items Only */}
        <div className="max-h-[40vh] overflow-y-auto scrollbar-hide overscroll-behavior-contain" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
          {lines.length > 0 ? (
            <div className="space-y-3">
              {lines.map((line) => (
                <div
                  key={line.id}
                  className="bg-[#2d2d2d] rounded-lg p-4 border border-gray-700"
                >
                  <div className="mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-white text-sm sm:text-base">
                        {line.item_name}
                      </h4>
                      {line.voucher && !hideVoucherDisplay && (
                        <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded font-medium">
                          Voucher Applied
                        </span>
                      )}
                    </div>
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
                    {line.voucher && !hideVoucherDisplay && (
                      <p className="text-xs text-green-400">
                        {line.voucher.name} ({line.voucher.discountType === 'percentage' ? `${line.voucher.discountValue}% off` : line.voucher.discountType === 'fixed' ? `£${line.voucher.discountValue} off` : 'Free'})
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
                      {line.voucher && !hideVoucherDisplay ? (
                        <>
                          <span className="line-through text-gray-500 text-sm mr-2">
                            {formatCurrency((line.unit_price + line.modifiers.reduce((sum, m) => sum + m.price_adjustment, 0)) * line.quantity)}
                          </span>
                          {formatCurrency(
                            (() => {
                              const fullPrice = (line.unit_price + line.modifiers.reduce((sum, m) => sum + m.price_adjustment, 0)) * line.quantity;
                              if (line.voucher.discountType === 'percentage') {
                                return fullPrice * (1 - line.voucher.discountValue / 100);
                              } else if (line.voucher.discountType === 'fixed') {
                                return Math.max(0, fullPrice - line.voucher.discountValue);
                              } else if (line.voucher.discountType === 'free_item' || line.voucher.discountType === 'free_modifier') {
                                const oneUnit = line.unit_price + line.modifiers.reduce((sum, m) => sum + m.price_adjustment, 0);
                                return fullPrice - oneUnit;
                              }
                              return fullPrice;
                            })()
                          )}
                        </>
                      ) : (
                        formatCurrency((line.unit_price + line.modifiers.reduce((sum, m) => sum + m.price_adjustment, 0)) * line.quantity)
                      )}
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
          <div className="pt-3 flex gap-2 flex-shrink-0">
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                hapticDelete();
                onClearAll();
              }}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0 active:scale-95 transition-transform"
            >
              <Trash2 className="h-5 w-5 mr-2" />
              Clear All
            </Button>
          </div>
        )}

        {/* Fixed Totals - Always Visible */}
        {(lines.length > 0 || basketVoucher) && (
          <div className="border-t border-gray-700 pt-4 mt-4 space-y-2 px-4">
              <div className="flex justify-between text-base">
                <span className="text-gray-400">Subtotal</span>
                <span className="font-semibold text-white">{formatCurrency(getSubtotal())}</span>
              </div>
              <div className="flex justify-between text-base">
                <span className="text-gray-400">Tax (20%)</span>
                <span className="font-semibold text-white">{formatCurrency(getTaxTotal())}</span>
              </div>
              {basketVoucher && getBasketVoucherDiscount && (
                <div className="flex justify-between text-base">
                  <span className="text-green-400">{basketVoucher.name}</span>
                  <span className="font-semibold text-green-400">-{formatCurrency(getBasketVoucherDiscount())}</span>
                </div>
              )}
              <div className="flex justify-between text-2xl font-bold border-t border-gray-700 pt-3">
                <span className="text-white">Total</span>
                <span className="text-penkey-orange">{formatCurrency(getTotal())}</span>
              </div>
            </div>
        )}

        {/* Fixed Action Buttons - Mobile-friendly grid layout */}
        <div className="pt-4 space-y-2">
            {/* Row 1: Save and Print side by side */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={lines.length === 0}
                onClick={() => {
                  hapticButtonPress();
                  onClose();
                  onSave();
                }}
                className="px-3 py-3 bg-[#4d4d4d] hover:bg-[#5d5d5d] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors border border-gray-600 flex items-center justify-center gap-2 text-sm active:scale-95"
              >
                <Save className="h-5 w-5" />
                Save
              </button>
              <button
                type="button"
                disabled={lines.length === 0}
                onClick={() => {
                  hapticButtonPress();
                  onPrint();
                }}
                className="px-3 py-3 bg-[#4d4d4d] hover:bg-[#5d5d5d] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors border border-gray-600 flex items-center justify-center gap-2 text-sm active:scale-95"
              >
                <Printer className="h-5 w-5" />
                Print
              </button>
            </div>
            {/* Row 2: Charge - full width, prominent */}
            <button
              type="button"
              disabled={lines.length === 0}
              onClick={() => {
                hapticSuccess();
                onClose();
                onCheckout();
              }}
              className="w-full px-4 py-8 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center text-2xl active:scale-95"
            >
              Charge {formatCurrency(getTotal())}
            </button>
          </div>
      </div>
    </div>
  );
}
