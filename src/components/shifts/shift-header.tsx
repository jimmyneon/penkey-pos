"use client";

import { Clock, DollarSign, TrendingUp } from "lucide-react";

interface ShiftData {
  id: string;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  variance: number | null;
}

interface ShiftHeaderProps {
  shift: ShiftData;
}

export function ShiftHeader({ shift }: ShiftHeaderProps) {
  const openedTime = new Date(shift.opened_at);
  const durationMs = Date.now() - openedTime.getTime();
  const hours = Math.floor(durationMs / 3600000);
  const minutes = Math.floor((durationMs % 3600000) / 60000);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-3">
      {/* Time Info */}
      <div className="bg-[#3d3d3d] rounded-lg p-4 flex items-center gap-3 border border-gray-700">
        <Clock className="h-5 w-5 text-penkey-orange flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-gray-400">Shift Duration</p>
          <p className="text-base sm:text-lg font-semibold">
            {hours}h {minutes}m
          </p>
        </div>
        <div className="text-right text-xs sm:text-sm text-gray-400 flex-shrink-0">
          <p>Opened: {formatTime(openedTime)}</p>
        </div>
      </div>

      {/* Cash Info */}
      <div className="bg-[#3d3d3d] rounded-lg p-4 flex items-center gap-3 border border-gray-700">
        <DollarSign className="h-5 w-5 text-green-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-gray-400">Opening Cash</p>
          <p className="text-base sm:text-lg font-semibold">£{shift.opening_cash.toFixed(2)}</p>
        </div>
      </div>

      {/* Variance Info (if closed) */}
      {shift.closing_cash !== null && shift.variance !== null && (
        <div className={`bg-[#3d3d3d] rounded-lg p-4 flex items-center gap-3 border-l-4 ${
          shift.variance === 0 ? 'border-l-green-500 border border-gray-700' : 'border-l-yellow-500 border border-gray-700'
        }`}>
          <TrendingUp className={`h-5 w-5 flex-shrink-0 ${shift.variance === 0 ? 'text-green-500' : 'text-yellow-500'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm text-gray-400">Variance</p>
            <p className={`text-base sm:text-lg font-semibold ${shift.variance === 0 ? 'text-green-400' : 'text-yellow-400'}`}>
              {shift.variance >= 0 ? '+' : ''}£{shift.variance.toFixed(2)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
