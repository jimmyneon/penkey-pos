"use client";

import { useEffect, useState } from "react";
import { TrendingUp, ShoppingCart, BarChart3, AlertCircle } from "lucide-react";

interface SalesSummaryData {
  totalSales: number;
  itemsSold: number;
  transactions: number;
  refunds: number;
  refundAmount: number;
  voids: number;
  voidAmount: number;
}

interface ShiftSalesSummaryProps {
  shiftId: string;
}

export function ShiftSalesSummary({ shiftId }: ShiftSalesSummaryProps) {
  const [data, setData] = useState<SalesSummaryData>({
    totalSales: 0,
    itemsSold: 0,
    transactions: 0,
    refunds: 0,
    refundAmount: 0,
    voids: 0,
    voidAmount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSalesData();
    // Refresh every 30 seconds
    const interval = setInterval(loadSalesData, 30000);
    return () => clearInterval(interval);
  }, [shiftId]);

  const loadSalesData = async () => {
    try {
      const response = await fetch(`/api/shifts/${shiftId}/sales-summary`);
      if (response.ok) {
        const data = await response.json();
        setData(data);
      }
    } catch (error) {
      console.error("Failed to load sales data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#3d3d3d] rounded-lg p-4 border border-gray-700 animate-pulse">
        <p className="text-gray-400">Loading sales data...</p>
      </div>
    );
  }

  const avgTicket = data.transactions > 0 ? data.totalSales / data.transactions : 0;
  const totalAdjustments = data.refundAmount + data.voidAmount;

  return (
    <div className="bg-[#3d3d3d] rounded-lg p-4 sm:p-6 border border-gray-700">
      <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-penkey-orange" />
        Sales Summary
      </h3>

      <div className="space-y-3">
        {/* Total Sales */}
        <div className="flex items-center justify-between bg-[#2d2d2d] rounded p-3 border border-gray-700">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-400" />
            <span className="text-sm text-gray-300">Total Sales</span>
          </div>
          <span className="text-lg font-bold text-green-400">£{data.totalSales.toFixed(2)}</span>
        </div>

        {/* Items Sold */}
        <div className="flex items-center justify-between bg-[#2d2d2d] rounded p-3 border border-gray-700">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-gray-300">Items Sold</span>
          </div>
          <span className="text-lg font-bold text-blue-400">{data.itemsSold}</span>
        </div>

        {/* Transactions */}
        <div className="flex items-center justify-between bg-[#2d2d2d] rounded p-3 border border-gray-700">
          <span className="text-sm text-gray-300">Transactions</span>
          <span className="text-lg font-bold text-white">{data.transactions}</span>
        </div>

        {/* Avg Ticket */}
        <div className="flex items-center justify-between bg-[#2d2d2d] rounded p-3 border border-gray-700">
          <span className="text-sm text-gray-300">Avg Ticket</span>
          <span className="text-lg font-bold text-white">£{avgTicket.toFixed(2)}</span>
        </div>

        {/* Adjustments */}
        {totalAdjustments > 0 && (
          <div className="flex items-center justify-between bg-red-900/20 rounded p-3 border border-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <span className="text-sm text-gray-300">Refunds/Voids</span>
            </div>
            <span className="text-lg font-bold text-red-400">
              {data.refunds + data.voids} (£{totalAdjustments.toFixed(2)})
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
