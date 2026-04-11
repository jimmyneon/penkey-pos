"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, Button, Input } from "@penkey/ui";
import { formatCurrency } from "@penkey/ui";
import { AlertTriangle, DollarSign, Lock } from "lucide-react";
import { verifyPinLocally, getCachedRegister } from "@/lib/services/pin-cache";

interface ReceiptLine {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  modifiers?: any;
}

interface RefundDialogProps {
  open: boolean;
  onClose: () => void;
  onRefund: (amount: number, reason: string, selectedItems?: string[]) => void;
  maxAmount: number;
  receiptNumber: string;
  items?: ReceiptLine[];
}

export function RefundDialog({ 
  open, 
  onClose, 
  onRefund, 
  maxAmount,
  receiptNumber,
  items = []
}: RefundDialogProps) {
  const [refundAmount, setRefundAmount] = useState(maxAmount.toString());
  const [reason, setReason] = useState("");
  const [isPartial, setIsPartial] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Get org_id from session on mount
  useEffect(() => {
    if (open) {
      const sessionData = sessionStorage.getItem("pos_session");
      if (sessionData) {
        setOrgId(JSON.parse(sessionData).org_id);
      }
    }
  }, [open]);

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

  const handleRefund = async () => {
    if (isPartial && selectedItems.size === 0) {
      alert("Please select items to refund");
      return;
    }
    const amount = isPartial ? calculateSelectedItemsTotal() : parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0 || amount > maxAmount) {
      alert("Invalid refund amount");
      return;
    }
    if (!reason.trim()) {
      alert("Please provide a reason for the refund");
      return;
    }
    // Show PIN entry before processing refund
    setShowPinEntry(true);
    setPin("");
    setPinError("");
  };

  const handlePinSubmit = async () => {
    if (pin.length !== 4) {
      setPinError("Please enter a 4-digit PIN");
      return;
    }

    setVerifyingPin(true);
    setPinError("");

    try {
      let verified = false;

      // Try local verification first
      if (orgId) {
        const localResult = await verifyPinLocally(pin, orgId);
        if (localResult) {
          verified = true;
        }
      }

      // Fallback to API if local verification fails
      if (!verified) {
        const response = await fetch("/api/auth/pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ pin }),
        });

        if (response.ok) {
          verified = true;
        }
      }

      if (verified) {
        const amount = isPartial ? calculateSelectedItemsTotal() : parseFloat(refundAmount);
        onRefund(amount, reason, isPartial ? Array.from(selectedItems) : undefined);
        handleClose();
      } else {
        setPinError("Invalid PIN");
        setPin("");
      }
    } catch (err) {
      setPinError("PIN verification failed");
      setPin("");
    } finally {
      setVerifyingPin(false);
    }
  };

  const handlePinPadClick = (num: string) => {
    if (pin.length < 4) {
      setPin(pin + num);
      setPinError("");
    }
  };

  const handlePinClear = () => {
    setPin("");
    setPinError("");
  };

  const calculateSelectedItemsTotal = () => {
    return items
      .filter(item => selectedItems.has(item.id))
      .reduce((sum, item) => sum + item.line_total, 0);
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
    if (newSelected.size > 0) {
      const total = items
        .filter(item => newSelected.has(item.id))
        .reduce((sum, item) => sum + item.line_total, 0);
      setRefundAmount(total.toString());
    }
  };

  const handleClose = () => {
    setRefundAmount(maxAmount.toString());
    setReason("");
    setIsPartial(false);
    setSelectedItems(new Set());
    setShowPinEntry(false);
    setPin("");
    setPinError("");
    onClose();
  };

  const amount = parseFloat(refundAmount) || 0;
  const isValid = amount > 0 && amount <= maxAmount && reason.trim().length > 0;

  // Auto-submit PIN when 4 digits entered
  useEffect(() => {
    if (pin.length === 4 && showPinEntry) {
      handlePinSubmit();
    }
  }, [pin, showPinEntry]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-16px)] sm:max-w-md bg-[#3d3d3d] border-gray-700 max-h-[85vh] overflow-y-auto">
        {showPinEntry ? (
          <>
            <DialogTitle className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Lock className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
              PIN Required
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-400">
              Enter your PIN to authorize this refund
            </DialogDescription>

            <div className="space-y-4 mt-4">
              {/* PIN Display */}
              <div className="flex justify-center gap-3 sm:gap-4 mb-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-lg border-2 flex items-center justify-center ${
                      pin.length > i
                        ? "border-penkey-orange bg-penkey-orange"
                        : "border-gray-600 bg-[#2d2d2d]"
                    }`}
                  >
                    {pin.length > i && (
                      <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-white"></div>
                    )}
                  </div>
                ))}
              </div>

              {pinError && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                  <p className="text-center text-red-400 text-sm font-medium">
                    {pinError}
                  </p>
                </div>
              )}

              {verifyingPin && (
                <div className="text-center text-gray-400 text-sm">
                  Verifying...
                </div>
              )}

              {/* PIN Pad */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    onClick={() => handlePinPadClick(num.toString())}
                    disabled={verifyingPin}
                    className="h-14 sm:h-16 text-xl sm:text-2xl font-semibold rounded-md bg-[#4d4d4d] border-2 border-gray-600 hover:bg-[#5d5d5d] active:scale-95 active:bg-[#5d5d5d] text-white disabled:opacity-50"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={handlePinClear}
                  disabled={verifyingPin}
                  className="h-14 sm:h-16 rounded-md bg-[#4d4d4d] border-2 border-gray-600 hover:bg-[#5d5d5d] active:scale-95 active:bg-[#5d5d5d] text-white disabled:opacity-50 flex items-center justify-center"
                >
                  <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
                <button
                  onClick={() => handlePinPadClick("0")}
                  disabled={verifyingPin}
                  className="h-14 sm:h-16 text-xl sm:text-2xl font-semibold rounded-md bg-[#4d4d4d] border-2 border-gray-600 hover:bg-[#5d5d5d] active:scale-95 active:bg-[#5d5d5d] text-white disabled:opacity-50"
                >
                  0
                </button>
                <div></div>
              </div>

              {/* Cancel Button */}
              <Button
                variant="outline"
                onClick={() => setShowPinEntry(false)}
                disabled={verifyingPin}
                className="w-full border-gray-600 text-gray-300 hover:bg-[#2d2d2d]"
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogTitle className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
              Refund Transaction
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-400">
              Process a refund for receipt {receiptNumber}
            </DialogDescription>

            <div className="space-y-3 mt-3">
          {/* Refund Type */}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => {
                setIsPartial(false);
                setRefundAmount(maxAmount.toString());
              }}
              className={`flex-1 px-3 py-2.5 sm:py-3 rounded-lg border-2 transition-colors ${
                !isPartial
                  ? 'border-red-500 bg-red-900/30 text-red-400'
                  : 'border-gray-600 text-gray-300 hover:border-gray-500'
              }`}
            >
              <div className="font-medium text-sm sm:text-base">Full Refund</div>
              <div className="text-xs sm:text-sm">{formatCurrency(maxAmount)}</div>
            </button>
            <button
              onClick={() => {
                setIsPartial(true);
                setRefundAmount("");
              }}
              className={`flex-1 px-3 py-2.5 sm:py-3 rounded-lg border-2 transition-colors ${
                isPartial
                  ? 'border-red-500 bg-red-900/30 text-red-400'
                  : 'border-gray-600 text-gray-300 hover:border-gray-500'
              }`}
            >
              <div className="font-medium text-sm sm:text-base">Partial Refund</div>
              <div className="text-xs sm:text-sm">Custom amount</div>
            </button>
          </div>

          {/* Item Selection (for partial refunds) */}
          {isPartial && items.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Items to Refund
              </label>
              <div className="max-h-40 sm:max-h-48 overflow-y-auto border border-gray-600 rounded-lg bg-[#2d2d2d]">
                {items.map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 cursor-pointer hover:bg-[#3d3d3d] border-b border-gray-700 last:border-0 active:bg-[#4d4d4d] ${
                      selectedItems.has(item.id) ? 'bg-red-900/20' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={() => toggleItemSelection(item.id)}
                      className="w-4 h-4 accent-penkey-orange bg-[#2d2d2d] border-gray-600 rounded focus:ring-penkey-orange flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate text-sm sm:text-base">{item.name}</div>
                      <div className="text-xs sm:text-sm text-gray-400">
                        {item.quantity} × {formatCurrency(item.unit_price)}
                      </div>
                    </div>
                    <div className="font-medium text-white text-sm sm:text-base flex-shrink-0">
                      {formatCurrency(item.line_total)}
                    </div>
                  </label>
                ))}
              </div>
              {selectedItems.size > 0 && (
                <div className="mt-2 p-2 bg-red-900/20 rounded border border-red-800">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Selected items total:</span>
                    <span className="font-bold text-red-400">
                      {formatCurrency(calculateSelectedItemsTotal())}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Reason for Refund *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for refund..."
              className="w-full px-3 py-2 bg-[#2d2d2d] border border-gray-600 text-white placeholder-gray-500 rounded-lg focus:border-red-500 focus:outline-none resize-none text-sm sm:text-base"
              rows={2}
            />
          </div>

          {/* Warning */}
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-2 sm:p-3">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-red-300">
                <p className="font-medium mb-1">Warning</p>
                <p>This action cannot be undone. The refund will be processed immediately and the receipt status will be updated.</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 sticky bottom-0 bg-[#3d3d3d] pb-2 -mb-2">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1 border-gray-600 text-gray-300 hover:bg-[#2d2d2d] h-11 sm:h-10 text-sm sm:text-base"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRefund}
              disabled={!isValid}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed h-11 sm:h-10 text-sm sm:text-base"
            >
              Process Refund
            </Button>
          </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
