"use client";

import { useEffect, useState } from "react";
import { Plus, Minus, Clock } from "lucide-react";

interface CashMovement {
  id: string;
  type: "pay_in" | "pay_out";
  amount: number;
  reason: string;
  created_at: string;
}

interface CashMovementsListProps {
  shiftId: string;
}

export function CashMovementsList({ shiftId }: CashMovementsListProps) {
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMovements();
  }, [shiftId]);

  useEffect(() => {
    const handleReload = (event: any) => {
      if (event.detail.shiftId === shiftId) {
        loadMovements();
      }
    };

    window.addEventListener('reloadCashMovements', handleReload);
    return () => window.removeEventListener('reloadCashMovements', handleReload);
  }, [shiftId]);

  const loadMovements = async () => {
    try {
      const response = await fetch(`/api/shifts/${shiftId}/cash-movements`);
      if (response.ok) {
        const data = await response.json();
        setMovements(data);
      }
    } catch (error) {
      console.error("Failed to load cash movements:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalIn = movements
    .filter((m) => m.type === "pay_in")
    .reduce((sum, m) => sum + m.amount, 0);

  const totalOut = movements
    .filter((m) => m.type === "pay_out")
    .reduce((sum, m) => sum + m.amount, 0);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <Clock className="h-5 w-5 animate-spin mx-auto text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-900/20 border border-green-700 rounded-lg p-3 sm:p-4">
          <p className="text-xs text-gray-400 mb-1">Cash In</p>
          <p className="text-base sm:text-lg font-semibold text-green-400">£{totalIn.toFixed(2)}</p>
        </div>
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 sm:p-4">
          <p className="text-xs text-gray-400 mb-1">Cash Out</p>
          <p className="text-base sm:text-lg font-semibold text-red-400">£{totalOut.toFixed(2)}</p>
        </div>
      </div>

      {/* Movements List */}
      {movements.length > 0 ? (
        <div className="bg-[#3d3d3d] rounded-lg divide-y divide-gray-700 max-h-64 overflow-y-auto border border-gray-700" style={{ WebkitOverflowScrolling: 'touch' }}>
          {movements.map((movement) => (
            <div key={movement.id} className="p-3 sm:p-4 flex items-center gap-3 hover:bg-gray-700/30 transition-colors">
              <div className={`p-2 rounded-lg flex-shrink-0 ${
                movement.type === "pay_in"
                  ? "bg-green-900/30 text-green-400"
                  : "bg-red-900/30 text-red-400"
              }`}>
                {movement.type === "pay_in" ? (
                  <Plus className="h-4 w-4" />
                ) : (
                  <Minus className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base font-semibold truncate">{movement.reason}</p>
                <p className="text-xs text-gray-400">{formatTime(movement.created_at)}</p>
              </div>
              <p className={`text-sm sm:text-base font-semibold whitespace-nowrap flex-shrink-0 ${
                movement.type === "pay_in" ? "text-green-400" : "text-red-400"
              }`}>
                {movement.type === "pay_in" ? "+" : "-"}£{movement.amount.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#3d3d3d] rounded-lg p-6 sm:p-8 text-center text-gray-400 border border-gray-700">
          <p className="text-sm sm:text-base">No cash movements recorded yet</p>
        </div>
      )}
    </div>
  );
}
