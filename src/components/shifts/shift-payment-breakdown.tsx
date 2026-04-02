"use client";

import { useEffect, useState } from "react";
import { CreditCard, Banknote } from "lucide-react";

interface PaymentBreakdownData {
  cashTotal: number;
  cardTotal: number;
  otherTotal: number;
}

interface ShiftPaymentBreakdownProps {
  shiftId: string;
}

export function ShiftPaymentBreakdown({ shiftId }: ShiftPaymentBreakdownProps) {
  const [data, setData] = useState<PaymentBreakdownData>({
    cashTotal: 0,
    cardTotal: 0,
    otherTotal: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPaymentData();
    const interval = setInterval(loadPaymentData, 30000);
    return () => clearInterval(interval);
  }, [shiftId]);

  const loadPaymentData = async () => {
    try {
      const response = await fetch(`/api/shifts/${shiftId}/payment-breakdown`);
      if (response.ok) {
        const data = await response.json();
        setData(data);
      }
    } catch (error) {
      console.error("Failed to load payment data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#3d3d3d] rounded-lg p-4 border border-gray-700 animate-pulse">
        <p className="text-gray-400">Loading payment data...</p>
      </div>
    );
  }

  const total = data.cashTotal + data.cardTotal + data.otherTotal;
  const cashPercent = total > 0 ? (data.cashTotal / total) * 100 : 0;
  const cardPercent = total > 0 ? (data.cardTotal / total) * 100 : 0;
  const otherPercent = total > 0 ? (data.otherTotal / total) * 100 : 0;

  return (
    <div className="bg-[#3d3d3d] rounded-lg p-4 sm:p-6 border border-gray-700">
      <h3 className="text-base sm:text-lg font-semibold mb-4">Payment Methods</h3>

      <div className="space-y-4">
        {/* Cash */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-green-400" />
              <span className="text-sm text-gray-300">Cash</span>
            </div>
            <span className="text-sm font-semibold text-green-400">
              £{data.cashTotal.toFixed(2)} ({cashPercent.toFixed(0)}%)
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${cashPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Card */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-gray-300">Card</span>
            </div>
            <span className="text-sm font-semibold text-blue-400">
              £{data.cardTotal.toFixed(2)} ({cardPercent.toFixed(0)}%)
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${cardPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Other */}
        {data.otherTotal > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300">Other</span>
              <span className="text-sm font-semibold text-purple-400">
                £{data.otherTotal.toFixed(2)} ({otherPercent.toFixed(0)}%)
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all"
                style={{ width: `${otherPercent}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Total */}
        <div className="pt-3 border-t border-gray-600">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-300">Total</span>
            <span className="text-lg font-bold text-penkey-orange">£{total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
