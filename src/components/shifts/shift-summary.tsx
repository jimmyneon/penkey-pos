"use client";

import { DollarSign, TrendingUp, AlertCircle } from "lucide-react";

interface ShiftSummaryProps {
  openingCash: number;
  closingCash: number;
  expectedCash: number;
  variance: number;
}

export function ShiftSummary({
  openingCash,
  closingCash,
  expectedCash,
  variance,
}: ShiftSummaryProps) {
  const variancePercentage = expectedCash > 0 ? (variance / expectedCash) * 100 : 0;
  const isAccurate = Math.abs(variance) < 0.01;

  return (
    <div className="space-y-3">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-1">Opening Cash</p>
          <p className="text-lg font-semibold">£{openingCash.toFixed(2)}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-1">Closing Cash</p>
          <p className="text-lg font-semibold">£{closingCash.toFixed(2)}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-1">Expected Cash</p>
          <p className="text-lg font-semibold">£{expectedCash.toFixed(2)}</p>
        </div>
        <div className={`rounded-lg p-4 ${
          isAccurate ? 'bg-green-900/30 border border-green-700' : 'bg-yellow-900/30 border border-yellow-700'
        }`}>
          <p className="text-xs text-gray-400 mb-1">Variance</p>
          <p className={`text-lg font-semibold ${isAccurate ? 'text-green-400' : 'text-yellow-400'}`}>
            {variance >= 0 ? '+' : ''}£{variance.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Variance Alert */}
      {!isAccurate && (
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-400">Variance Detected</p>
            <p className="text-sm text-yellow-300 mt-1">
              Difference of £{Math.abs(variance).toFixed(2)} ({variancePercentage.toFixed(1)}%)
            </p>
          </div>
        </div>
      )}

      {/* Accuracy Badge */}
      {isAccurate && (
        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 flex gap-3">
          <TrendingUp className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-400">Perfect Count</p>
            <p className="text-sm text-green-300 mt-1">
              Cash count matches expected amount exactly
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
