"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface HourlyData {
  hour: string;
  sales: number;
  items: number;
  transactions: number;
}

interface ShiftHourlyBreakdownProps {
  shiftId: string;
}

export function ShiftHourlyBreakdown({ shiftId }: ShiftHourlyBreakdownProps) {
  const [data, setData] = useState<HourlyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHourlyData();
    const interval = setInterval(loadHourlyData, 30000);
    return () => clearInterval(interval);
  }, [shiftId]);

  const loadHourlyData = async () => {
    try {
      const response = await fetch(`/api/shifts/${shiftId}/hourly-breakdown`);
      if (response.ok) {
        const data = await response.json();
        setData(data);
      }
    } catch (error) {
      console.error("Failed to load hourly data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || data.length === 0) {
    return null;
  }

  const maxSales = Math.max(...data.map(d => d.sales), 1);

  return (
    <div className="bg-[#3d3d3d] rounded-lg p-4 sm:p-6 border border-gray-700">
      <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-penkey-orange" />
        Hourly Breakdown
      </h3>

      <div className="space-y-2 max-h-64 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        {data.map((hour) => (
          <div key={hour.hour} className="bg-[#2d2d2d] rounded p-3 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-300">{hour.hour}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-green-400">£{hour.sales.toFixed(2)}</span>
                <span className="text-xs text-gray-400">{hour.items} items</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-700 rounded-full h-2">
                <div
                  className="bg-penkey-orange h-2 rounded-full transition-all"
                  style={{ width: `${(hour.sales / maxSales) * 100}%` }}
                ></div>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {hour.transactions} txn
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
