"use client";

import { useState } from "react";
import { ChevronDown, Layers, Printer } from "lucide-react";
import { VoucherCard } from "./voucher-card";

interface VoucherBatchCardProps {
  vouchers: any[];
  onSelectVoucher: (voucher: any) => void;
  onPrintBatch: (voucherId: string) => void;
}

export function VoucherBatchCard({ vouchers, onSelectVoucher, onPrintBatch }: VoucherBatchCardProps) {
  const [expanded, setExpanded] = useState(false);
  const first = vouchers[0];
  const activeCount = vouchers.filter((v) => v.status === "active").length;
  const batchLabel = first.batch_label || "Batch";

  return (
    <div className="border-b border-gray-700/50">
      <button
        onClick={() => {
          setExpanded(!expanded);
        }}
        className="w-full text-left px-4 py-3.5 hover:bg-white/5 active:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-500/15 to-cyan-500/5 rounded-xl p-2.5 flex-shrink-0 border border-gray-700/30">
            <Layers className="h-5 w-5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="font-semibold text-white text-sm">{batchLabel}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-medium">
                {vouchers.length} vouchers
              </span>
            </div>
            <div className="text-xs text-gray-500">
              {activeCount} active · {vouchers.length - activeCount} used
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPrintBatch(first.id);
              }}
              className="p-2 rounded-lg bg-[#4d4d4d] hover:bg-[#5d5d5d] text-gray-300"
              title="Print all"
            >
              <Printer className="h-4 w-4" />
            </button>
            <ChevronDown
              className={`h-5 w-5 text-gray-500 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </div>
        </div>
      </button>
      {expanded && (
        <div className="bg-[#252525] divide-y divide-gray-700/30">
          {vouchers.map((voucher) => (
            <VoucherCard
              key={voucher.id}
              voucher={voucher}
              onClick={() => onSelectVoucher(voucher)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
