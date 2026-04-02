"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from "lucide-react";

interface CashReconciliationProps {
  shiftId: string;
  openingCash: number;
  floatAmount: number;
  closingCash?: number;
  isOpen?: boolean; // Whether shift is currently open
  closedAt?: string; // Date shift was closed
}

interface ReconciliationData {
  float: number;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  refunds: number;
  expectedCash: number;
  actualCash: number;
  variance: number;
  amountToRemove: number;
}

export function CashReconciliation({ shiftId, openingCash, floatAmount, closingCash, isOpen = true, closedAt }: CashReconciliationProps) {
  const [data, setData] = useState<ReconciliationData>({
    float: floatAmount,
    cashSales: 0,
    cashIn: 0,
    cashOut: 0,
    refunds: 0,
    expectedCash: openingCash,
    actualCash: closingCash || 0,
    variance: 0,
    amountToRemove: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReconciliationData();
  }, [shiftId, closingCash]);

  const loadReconciliationData = async () => {
    try {
      setLoading(true);

      // Get cash movements
      const movementsResponse = await fetch(`/api/shifts/${shiftId}/cash-movements`);
      const movements = movementsResponse.ok ? await movementsResponse.json() : [];

      // Calculate cash in/out
      const cashIn = movements
        .filter((m: any) => m.type === "pay_in")
        .reduce((sum: number, m: any) => sum + m.amount, 0);

      const cashOut = movements
        .filter((m: any) => m.type === "pay_out")
        .reduce((sum: number, m: any) => sum + m.amount, 0);

      // Get receipts for cash sales and refunds
      const receiptsResponse = await fetch(`/api/shifts/${shiftId}/receipts`);
      const receipts = receiptsResponse.ok ? await receiptsResponse.json() : [];

      // Calculate cash sales (only cash payments)
      let cashSales = 0;
      let refunds = 0;

      receipts.forEach((receipt: any) => {
        if (receipt.status === "fully_refunded" || receipt.status === "partially_refunded") {
          refunds += receipt.refunded_amount || 0;
        }
        
        // Get cash payments for this receipt (payments is the relation name)
        if (receipt.payments && Array.isArray(receipt.payments)) {
          receipt.payments.forEach((payment: any) => {
            if (payment.method === "cash") {
              cashSales += payment.amount;
            }
          });
        }
      });

      // Calculate expected cash
      const expectedCash = openingCash + cashSales + cashIn - cashOut - refunds;
      const actualCash = closingCash || 0;
      const variance = actualCash - expectedCash;
      const amountToRemove = Math.max(0, actualCash - floatAmount);

      setData({
        float: floatAmount,
        cashSales,
        cashIn,
        cashOut,
        refunds,
        expectedCash,
        actualCash,
        variance,
        amountToRemove,
      });
    } catch (error) {
      console.error("Failed to load reconciliation data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#3d3d3d] rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Cash Reconciliation</h3>
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#3d3d3d] rounded-lg p-4 sm:p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-penkey-orange" />
          Cash Reconciliation
          {!isOpen && <span className="text-xs text-gray-400 font-normal ml-2">(Closed)</span>}
        </h3>
        {closedAt && (
          <span className="text-xs text-gray-400">
            {new Date(closedAt).toLocaleDateString('en-GB', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* Opening Cash */}
        <div className="bg-[#2d2d2d] rounded-lg p-3 border border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-gray-400">Opening Cash</span>
            <span className="text-sm sm:text-base font-semibold text-white">£{openingCash.toFixed(2)}</span>
          </div>
        </div>

        {/* Cash Sales */}
        <div className="bg-green-900/20 rounded-lg p-3 border border-green-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <span className="text-xs sm:text-sm text-gray-300">Cash Sales</span>
            </div>
            <span className="text-sm sm:text-base font-semibold text-green-400">+£{data.cashSales.toFixed(2)}</span>
          </div>
        </div>

        {/* Cash In */}
        {data.cashIn > 0 && (
          <div className="bg-green-900/20 rounded-lg p-3 border border-green-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <span className="text-xs sm:text-sm text-gray-300">Cash In</span>
              </div>
              <span className="text-sm sm:text-base font-semibold text-green-400">+£{data.cashIn.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Cash Out */}
        {data.cashOut > 0 && (
          <div className="bg-red-900/20 rounded-lg p-3 border border-red-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-400" />
                <span className="text-xs sm:text-sm text-gray-300">Cash Out</span>
              </div>
              <span className="text-sm sm:text-base font-semibold text-red-400">-£{data.cashOut.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Refunds */}
        {data.refunds > 0 && (
          <div className="bg-red-900/20 rounded-lg p-3 border border-red-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-400" />
                <span className="text-xs sm:text-sm text-gray-300">Refunds/Voids</span>
              </div>
              <span className="text-sm sm:text-base font-semibold text-red-400">-£{data.refunds.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-gray-600 my-3"></div>

        {/* Expected Cash */}
        <div className="bg-[#2d2d2d] rounded-lg p-3 border border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">Expected Cash in Till</span>
            <span className="text-lg font-bold text-penkey-orange">£{data.expectedCash.toFixed(2)}</span>
          </div>
        </div>

        {/* Actual Cash (if counted) */}
        {closingCash !== undefined && (
          <>
            <div className="bg-[#2d2d2d] rounded-lg p-3 border border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">Actual Cash Counted</span>
                <span className="text-lg font-bold text-white">£{data.actualCash.toFixed(2)}</span>
              </div>
            </div>

            {/* Variance */}
            <div className={`rounded-lg p-3 border ${
              Math.abs(data.variance) < 0.01 
                ? "bg-green-900/20 border-green-700" 
                : "bg-yellow-900/20 border-yellow-700"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {Math.abs(data.variance) < 0.01 ? (
                    <span className="text-sm font-medium text-green-400">Perfect!</span>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-yellow-400" />
                      <span className="text-sm font-medium text-gray-300">Variance</span>
                    </>
                  )}
                </div>
                <span className={`text-lg font-bold ${
                  Math.abs(data.variance) < 0.01 
                    ? "text-green-400" 
                    : data.variance > 0 
                    ? "text-green-400" 
                    : "text-red-400"
                }`}>
                  {data.variance > 0 ? "+" : ""}£{data.variance.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-600 my-3"></div>

            {/* Float */}
            <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-700">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">Float (stays in till)</span>
                <span className="text-base font-semibold text-blue-400">£{data.float.toFixed(2)}</span>
              </div>
            </div>

            {/* Amount to Remove */}
            <div className="bg-penkey-orange/20 rounded-lg p-4 border border-penkey-orange">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-white">Remove from Till</span>
                <span className="text-2xl font-bold text-penkey-orange">£{data.amountToRemove.toFixed(2)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
