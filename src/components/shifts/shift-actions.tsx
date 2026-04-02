"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, Button } from "@penkey/ui";
import { Plus, X, LogOut, Check } from "lucide-react";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { CashCountingHelper } from "./cash-counting-helper";

interface ShiftData {
  id: string;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  variance: number | null;
  float_amount: number;
  notes: string | null;
}

interface VarianceData {
  expected: number;
  actual: number;
  variance: number;
}

interface ShiftActionsProps {
  shiftId?: string;
  currentShift?: ShiftData | null;
  onOpenShift?: (openingCash: number, floatAmount: number) => void;
  onCloseShift?: (closingCash: number, notes: string, nextFloatAmount: number, cashRemoved?: boolean) => void;
  previousShift?: ShiftData | null;
  onMovementAdded?: () => void;
}

export function ShiftActions({ shiftId, currentShift, onOpenShift, onCloseShift, previousShift, onMovementAdded }: ShiftActionsProps) {
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showPreviousSuggestion, setShowPreviousSuggestion] = useState(false);
  const [showSetFloatDialog, setShowSetFloatDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showVarianceConfirm, setShowVarianceConfirm] = useState(false);
  const [showCashIn, setShowCashIn] = useState(false);
  const [showCashOut, setShowCashOut] = useState(false);
  const [openingCash, setOpeningCash] = useState(0); // This IS the float - starting amount in till
  const [closingCash, setClosingCash] = useState(0);
  const [notes, setNotes] = useState("");
  const [cashInReason, setCashInReason] = useState("");
  const [cashOutReason, setCashOutReason] = useState("");
  const [varianceData, setVarianceData] = useState<VarianceData | null>(null);
  const [cashWasRemoved, setCashWasRemoved] = useState(true); // Track if cash was removed to safe
  const [floatToKeep, setFloatToKeep] = useState(0); // Editable float amount

  // Manage scroll lock for all dialogs
  const anyDialogOpen = showOpenDialog || showPreviousSuggestion || showSetFloatDialog || showCloseDialog || showVarianceConfirm || showCashIn || showCashOut;
  useScrollLock(anyDialogOpen);
  

  // When user clicks "Open Shift" button, check if we should show suggestion first
  const handleOpenShiftClick = () => {
    console.log("Open Shift clicked. Previous shift:", previousShift);
    if (previousShift) {
      // Determine what cash is in the till
      let cashInTill = previousShift.closing_cash || 0;
      const cashRemoved = (previousShift as any).cash_removed;
      
      console.log("Previous shift cash_removed:", cashRemoved);
      console.log("Previous shift closing_cash:", previousShift.closing_cash);
      console.log("Previous shift float_amount:", previousShift.float_amount);
      
      // If cash was removed to safe, only float remains
      if (cashRemoved === true) {
        cashInTill = previousShift.float_amount || 0;
        console.log("Cash was removed - showing float only:", cashInTill);
      } else if (cashRemoved === false) {
        // Cash was NOT removed - all closing cash is still in till
        console.log("Cash was NOT removed - showing all closing cash:", cashInTill);
      } else {
        // Default: assume cash was removed (for backwards compatibility)
        console.log("cash_removed is undefined, defaulting to float:", previousShift.float_amount);
        cashInTill = previousShift.float_amount || 0;
      }
      
      console.log("Showing suggestion with cash in till:", cashInTill);
      setOpeningCash(cashInTill); // Opening cash = what's in the till
      setShowPreviousSuggestion(true);
    } else {
      // No previous shift, go straight to cash counting
      console.log("No previous shift, showing cash counting dialog");
      setShowOpenDialog(true);
    }
  };

  const handleOpenShift = () => {
    if (onOpenShift) {
      // openingCash IS the float - same thing
      onOpenShift(openingCash, openingCash);
      setShowOpenDialog(false);
      setOpeningCash(0);
    }
  };

  const handleCloseShift = async () => {
    if (!currentShift || closingCash < 0) return; // Allow 0

    try {
      // First, calculate what the variance would be
      const movementsResponse = await fetch(`/api/shifts/${currentShift.id}/cash-movements`);
      const movements = movementsResponse.ok ? await movementsResponse.json() : [];

      const receiptsResponse = await fetch(`/api/shifts/${currentShift.id}/receipts`);
      const receipts = receiptsResponse.ok ? await receiptsResponse.json() : [];

      // Calculate expected cash
      let cashSales = 0;
      let refunds = 0;
      receipts.forEach((receipt: any) => {
        if (receipt.status === "fully_refunded" || receipt.status === "partially_refunded") {
          refunds += receipt.refunded_amount || 0;
        }
        if (receipt.payments) {
          receipt.payments.forEach((payment: any) => {
            if (payment.method === "cash") {
              cashSales += payment.amount;
            }
          });
        }
      });

      const cashIn = movements
        .filter((m: any) => m.type === "pay_in")
        .reduce((sum: number, m: any) => sum + m.amount, 0);

      const cashOut = movements
        .filter((m: any) => m.type === "pay_out")
        .reduce((sum: number, m: any) => sum + m.amount, 0);

      const expectedCash = currentShift.opening_cash + cashSales + cashIn - cashOut - refunds;
      const variance = closingCash - expectedCash;

      // Show confirmation dialog
      setVarianceData({
        expected: expectedCash,
        actual: closingCash,
        variance: variance,
      });
      // Set initial float to keep (suggest opening cash amount)
      setFloatToKeep(currentShift.opening_cash);
      setShowVarianceConfirm(true);
    } catch (error) {
      console.error("Failed to calculate variance:", error);
    }
  };

  const confirmCloseShift = (removed?: boolean) => {
    if (onCloseShift) {
      // Use passed value or state value
      const finalCashRemoved = removed !== undefined ? removed : cashWasRemoved;
      console.log("Confirming close shift with cashRemoved:", finalCashRemoved);
      
      // Pass cashRemoved flag and floatToKeep (what's in till for next shift)
      onCloseShift(closingCash, notes, floatToKeep, finalCashRemoved);
      setShowCloseDialog(false);
      setShowVarianceConfirm(false);
      setClosingCash(0);
      setNotes("");
      setVarianceData(null);
      setFloatToKeep(0);
      setCashWasRemoved(true); // Reset for next shift
    }
  };

  return (
    <>
      {/* Previous Shift Suggestion Dialog */}
      {previousShift && showPreviousSuggestion && (
        <Dialog open={showPreviousSuggestion} onOpenChange={setShowPreviousSuggestion}>
          <DialogContent className="w-[90vw] max-w-md bg-[#3d3d3d] text-white border-gray-700">
            <DialogTitle className="text-lg sm:text-xl font-bold">Opening Cash</DialogTitle>
            <DialogDescription className="text-sm text-gray-400">
              {(previousShift as any).cash_removed 
                ? "Float remaining in till from previous shift" 
                : "All cash from previous shift still in till"}
            </DialogDescription>

            <div className="space-y-3 my-4">
              <div className="bg-[#2d2d2d] rounded-lg p-4 border border-gray-700">
                <p className="text-xs text-gray-400 mb-1">Cash in Till (Opening Amount)</p>
                <p className="text-3xl font-bold text-penkey-orange">£{openingCash.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {previousShift.closed_at && new Date(previousShift.closed_at).toLocaleDateString('en-GB', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
                <p className="text-xs text-gray-400 mt-3">
                  {(previousShift as any).cash_removed 
                    ? "Float only (cash removed to safe)" 
                    : "All cash (nothing removed to safe)"}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setShowPreviousSuggestion(false);
                  setOpeningCash(0);
                  setShowOpenDialog(true);
                }}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white min-h-[44px]"
              >
                Modify
              </Button>
              <Button
                onClick={() => {
                  setShowPreviousSuggestion(false);
                  handleOpenShift();
                }}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white min-h-[44px] font-semibold flex items-center justify-center gap-2"
              >
                <Check className="h-4 w-4" />
                <span className="hidden sm:inline">Confirm</span>
                <span className="sm:hidden">Yes</span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Open Shift Dialog */}
      <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
        <DialogContent className="w-[90vw] max-w-md bg-[#3d3d3d] text-white border-gray-700 max-h-[90vh] overflow-y-auto">
          <DialogTitle className="text-lg sm:text-xl font-bold">Open Shift</DialogTitle>
          <DialogDescription className="text-sm text-gray-400">
            Count the cash currently in the till
          </DialogDescription>

          <div className="space-y-3 py-4">
            <CashCountingHelper
              value={openingCash}
              onChange={setOpeningCash}
              label="Cash in Till"
            />
            <p className="text-xs text-gray-400 text-center">This is your starting amount for the shift</p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowOpenDialog(false)}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleOpenShift}
              className="flex-1 bg-penkey-orange hover:bg-penkey-orange/90 text-white min-h-[44px] font-semibold"
            >
              Open Shift
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove to Safe Dialog - HIDDEN (merged into variance confirmation) */}
      <Dialog open={false} onOpenChange={setShowSetFloatDialog}>
        <DialogContent className="w-[90vw] max-w-sm bg-[#3d3d3d] text-white border-gray-700">
          <DialogTitle className="text-lg sm:text-xl font-bold">Remove Cash to Safe?</DialogTitle>
          <DialogDescription className="text-sm text-gray-400">
            Choose whether to remove excess cash to safe or keep it all in the till
          </DialogDescription>

          <div className="space-y-3 py-4">
            {/* Cash Counted */}
            <div className="bg-[#2d2d2d] rounded-lg p-3 border border-gray-700">
              <p className="text-xs text-gray-400 mb-1">Total Cash Counted</p>
              <p className="text-2xl font-bold text-white">£{closingCash.toFixed(2)}</p>
            </div>
            
            {/* Float to Keep */}
            <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-700">
              <p className="text-xs text-gray-400 mb-1">Keep in Till (Float)</p>
              <p className="text-2xl font-bold text-blue-400">£{openingCash.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">For next shift's starting amount</p>
            </div>
            
            {/* Amount to Remove */}
            {closingCash > openingCash && (
              <div className="bg-green-900/20 rounded-lg p-3 border border-green-700">
                <p className="text-xs text-gray-400 mb-1">Remove to Safe</p>
                <p className="text-2xl font-bold text-green-400">£{(closingCash - openingCash).toFixed(2)}</p>
              </div>
            )}
            
            {closingCash <= openingCash && (
              <div className="bg-yellow-900/20 rounded-lg p-3 border border-yellow-700">
                <p className="text-xs text-gray-400 mb-1">Status</p>
                <p className="text-sm text-yellow-400">No excess to remove - all cash stays in till</p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowSetFloatDialog(false);
                setShowCloseDialog(true);
              }}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white min-h-[44px]"
            >
              Back
            </Button>
            <Button
              onClick={() => {
                setCashWasRemoved(true); // Cash was removed to safe
                setShowSetFloatDialog(false);
                handleCloseShift();
              }}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white min-h-[44px] font-semibold"
            >
              Yes, Remove
            </Button>
            <Button
              onClick={() => {
                setCashWasRemoved(false); // Cash was NOT removed, stays in till
                setShowSetFloatDialog(false);
                handleCloseShift();
              }}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white min-h-[44px] font-semibold"
            >
              No, Keep All
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="w-[90vw] max-w-md bg-[#3d3d3d] text-white border-gray-700 max-h-[90vh] overflow-y-auto">
          <DialogTitle className="text-lg sm:text-xl font-bold">Close Shift</DialogTitle>
          <DialogDescription className="text-sm text-gray-400">
            Count the cash and enter the closing amount
          </DialogDescription>

          <div className="space-y-3 py-4">
            <CashCountingHelper
              value={closingCash}
              onChange={setClosingCash}
              label="Closing Cash"
            />

            {/* Remove from Till Display */}
            {currentShift && closingCash > 0 && (
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">Float (stays in till):</span>
                  <span className="text-sm font-semibold text-white">£{currentShift.float_amount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-green-700/50">
                  <span className="text-base font-semibold text-green-400">Remove from till:</span>
                  <span className="text-xl font-bold text-green-400">
                    £{Math.max(0, closingCash - currentShift.float_amount).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium mb-1.5 text-gray-300">Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Busy day, short on change..."
                className="w-full bg-[#2d2d2d] border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-penkey-orange text-sm min-h-[60px]"
                rows={2}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowCloseDialog(false)}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (closingCash < 0) return; // Allow 0
                setShowCloseDialog(false);
                handleCloseShift(); // Calculate variance and show confirmation
              }}
              disabled={closingCash < 0}
              className="flex-1 bg-penkey-orange hover:bg-penkey-orange/90 text-white min-h-[44px] font-semibold disabled:opacity-50"
            >
              Next
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close Shift Confirmation Dialog */}
      <Dialog open={showVarianceConfirm} onOpenChange={setShowVarianceConfirm}>
        <DialogContent className="w-[90vw] max-w-md bg-[#3d3d3d] text-white border-gray-700 max-h-[90vh] overflow-y-auto">
          <DialogTitle className="text-lg sm:text-xl font-bold">Close Shift - Set Float</DialogTitle>
          <DialogDescription className="text-sm text-gray-400">
            How much cash stays in the till for tomorrow?
          </DialogDescription>

          {varianceData && (
            <div className="space-y-3 py-4">
              {/* Total Cash Counted */}
              <div className="bg-[#2d2d2d] rounded-lg p-4 border border-gray-700">
                <p className="text-xs text-gray-400 mb-1">Total Cash Counted</p>
                <p className="text-3xl font-bold text-white">£{varianceData.actual.toFixed(2)}</p>
              </div>

              {/* Float to Keep - EDITABLE */}
              <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700">
                <label className="block text-xs font-medium mb-2 text-gray-300">Float to Keep in Till</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={varianceData.actual}
                  value={floatToKeep}
                  onChange={(e) => setFloatToKeep(parseFloat(e.target.value) || 0)}
                  className="w-full bg-gray-600 text-center rounded px-3 py-2 text-2xl font-bold text-white border-0 focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[44px]"
                />
                <p className="text-xs text-gray-400 mt-2">This will be your starting amount tomorrow</p>
              </div>

              {/* Amount to Remove */}
              <div className="bg-green-900/20 rounded-lg p-4 border border-green-700">
                <p className="text-xs text-gray-400 mb-1">Remove to Safe</p>
                <p className="text-2xl font-bold text-green-400">£{Math.max(0, varianceData.actual - floatToKeep).toFixed(2)}</p>
              </div>

              {/* Variance Info */}
              {Math.abs(varianceData.variance) > 0.01 && (
                <div className={`rounded-lg p-3 border ${
                  Math.abs(varianceData.variance) <= 5
                    ? "bg-yellow-900/20 border-yellow-700"
                    : "bg-red-900/20 border-red-700"
                }`}>
                  <p className="text-xs text-gray-400 mb-1">Variance</p>
                  <p className={`text-lg font-bold ${
                    varianceData.variance > 0 ? "text-green-400" : "text-red-400"
                  }`}>
                    {varianceData.variance > 0 ? "+" : ""}£{varianceData.variance.toFixed(2)}
                  </p>
                </div>
              )}

              {/* Notes field */}
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-300">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Short on change, customer error..."
                  className="w-full bg-[#2d2d2d] border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-penkey-orange text-sm min-h-[50px]"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowVarianceConfirm(false);
                setShowCloseDialog(true);
              }}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white min-h-[44px]"
            >
              Back
            </Button>
            <Button
              onClick={() => confirmCloseShift(true)} // Pass true directly
              className="flex-1 bg-green-600 hover:bg-green-700 text-white min-h-[44px] font-semibold"
            >
              Yes, Removed
            </Button>
            <Button
              onClick={() => confirmCloseShift(false)} // Pass false directly
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white min-h-[44px] font-semibold"
            >
              No, Kept All
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cash In Dialog - Simple */}
      <Dialog open={showCashIn} onOpenChange={setShowCashIn}>
        <DialogContent className="w-[90vw] max-w-sm bg-[#3d3d3d] text-white border-gray-700">
          <DialogTitle className="text-lg sm:text-xl font-bold">Cash In</DialogTitle>
          <DialogDescription className="text-sm text-gray-400">
            Enter the amount to add
          </DialogDescription>

          <div className="space-y-3 py-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-gray-300">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={openingCash || ""}
                onChange={(e) => setOpeningCash(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full bg-[#2d2d2d] border border-gray-600 rounded px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-penkey-orange text-2xl font-semibold text-center min-h-[56px]"
                autoFocus
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium mb-1.5 text-gray-300">Reason</label>
              <input
                type="text"
                value={cashInReason}
                onChange={(e) => setCashInReason(e.target.value)}
                placeholder="e.g., Bank deposit, float top-up..."
                className="w-full bg-[#2d2d2d] border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-penkey-orange text-sm min-h-[44px]"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCashIn(false);
                setOpeningCash(0);
              }}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!shiftId || openingCash <= 0 || !cashInReason.trim()) return;
                try {
                  const response = await fetch(`/api/shifts/${shiftId}/cash-movements`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      type: "pay_in",
                      amount: openingCash,
                      reason: cashInReason.trim(),
                    }),
                  });
                  if (response.ok) {
                    setShowCashIn(false);
                    setOpeningCash(0);
                    setCashInReason("");
                    onMovementAdded?.();
                  }
                } catch (error) {
                  console.error("Failed to record cash in:", error);
                }
              }}
              disabled={!cashInReason.trim() || openingCash <= 0}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white min-h-[44px] font-semibold"
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cash Out Dialog - Simple */}
      <Dialog open={showCashOut} onOpenChange={setShowCashOut}>
        <DialogContent className="w-[90vw] max-w-sm bg-[#3d3d3d] text-white border-gray-700">
          <DialogTitle className="text-lg sm:text-xl font-bold">Cash Out</DialogTitle>
          <DialogDescription className="text-sm text-gray-400">
            Enter the amount to remove
          </DialogDescription>

          <div className="space-y-3 py-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-gray-300">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={closingCash || ""}
                onChange={(e) => setClosingCash(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full bg-[#2d2d2d] border border-gray-600 rounded px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-penkey-orange text-2xl font-semibold text-center min-h-[56px]"
                autoFocus
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium mb-1.5 text-gray-300">Reason</label>
              <input
                type="text"
                value={cashOutReason}
                onChange={(e) => setCashOutReason(e.target.value)}
                placeholder="e.g., Bank run, supplier payment..."
                className="w-full bg-[#2d2d2d] border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-penkey-orange text-sm min-h-[44px]"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCashOut(false);
                setClosingCash(0);
                setCashOutReason("");
              }}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!shiftId || closingCash <= 0 || !cashOutReason.trim()) return;
                try {
                  const response = await fetch(`/api/shifts/${shiftId}/cash-movements`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      type: "pay_out",
                      amount: closingCash,
                      reason: cashOutReason.trim(),
                    }),
                  });
                  if (response.ok) {
                    setShowCashOut(false);
                    setClosingCash(0);
                    setCashOutReason("");
                    onMovementAdded?.();
                  }
                } catch (error) {
                  console.error("Failed to record cash out:", error);
                }
              }}
              disabled={!cashOutReason.trim() || closingCash <= 0}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white min-h-[44px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Action Buttons */}
      <div className="space-y-2">
        {!shiftId ? (
          <Button
            onClick={handleOpenShiftClick}
            className="w-full bg-penkey-orange hover:bg-penkey-orange/90 text-white font-semibold py-3 sm:py-4 min-h-[48px] text-sm sm:text-base"
          >
            <Plus className="h-5 w-5 mr-2" />
            Open Shift
          </Button>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => setShowCashIn(true)}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 sm:py-4 min-h-[48px] text-xs sm:text-sm"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Cash In</span>
                <span className="sm:hidden">In</span>
              </Button>
              <Button
                onClick={() => setShowCashOut(true)}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 sm:py-4 min-h-[48px] text-xs sm:text-sm"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Cash Out</span>
                <span className="sm:hidden">Out</span>
              </Button>
            </div>
            <Button
              onClick={() => setShowCloseDialog(true)}
              className="w-full bg-red-700 hover:bg-red-800 text-white font-semibold py-3 sm:py-4 min-h-[48px] text-sm sm:text-base"
            >
              <LogOut className="h-5 w-5 mr-2" />
              Close Shift
            </Button>
          </>
        )}
      </div>
    </>
  );
}
