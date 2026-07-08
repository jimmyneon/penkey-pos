"use client";

import { DollarSign, Coffee, Percent, ChevronRight, User, Layers } from "lucide-react";

const STATUS_COLOURS: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  redeemed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  expired: "bg-red-500/20 text-red-400 border-red-500/30",
  cancelled: "bg-red-800/20 text-red-600 border-red-800/30",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);

const voucherLabel = (v: any) => {
  if (v.voucher_type === "amount") return formatCurrency(v.amount || 0);
  if (v.voucher_type === "percent") return `${v.percent_discount || 0}% off`;
  if (v.voucher_type === "item") {
    const prefix = v.item_selection_type === "category" ? "Free from" : "Free:";
    return `${prefix} ${v.item_name || "item"}`;
  }
  return "—";
};

const typeIcon = (type: string) => {
  if (type === "amount") return DollarSign;
  if (type === "item") return Coffee;
  return Percent;
};

const typeGradient = (type: string) => {
  if (type === "amount") return "from-amber-500/15 to-orange-500/5";
  if (type === "item") return "from-blue-500/15 to-cyan-500/5";
  return "from-purple-500/15 to-pink-500/5";
};

interface VoucherCardProps {
  voucher: any;
  onClick: () => void;
}

export function VoucherCard({ voucher, onClick }: VoucherCardProps) {
  const Icon = typeIcon(voucher.voucher_type);

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3.5 hover:bg-white/5 active:bg-white/10 transition-colors duration-150 group"
    >
      <div className="flex items-center gap-3">
        <div
          className={`bg-gradient-to-br ${typeGradient(voucher.voucher_type)} rounded-xl p-2.5 flex-shrink-0 border border-gray-700/30`}
        >
          <Icon className="h-5 w-5 text-gray-300" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-mono font-bold text-penkey-orange text-sm tracking-wider">
              {voucher.code}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full capitalize font-medium border ${
                STATUS_COLOURS[voucher.status] || ""
              }`}
            >
              {voucher.status}
            </span>
          </div>
          <div className="text-base font-semibold text-white truncate">{voucherLabel(voucher)}</div>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
            {voucher.min_spend && voucher.min_spend > 0 && (
              <span className="flex-shrink-0 text-amber-400/80">
                Min spend {formatCurrency(parseFloat(voucher.min_spend))}
              </span>
            )}
            {voucher.batch_label && (
              <span className="flex items-center gap-1 flex-shrink-0 text-blue-400/70">
                <Layers className="h-3 w-3" />
                <span className="truncate max-w-[80px]">{voucher.batch_label}</span>
              </span>
            )}
            {voucher.recipient_name && (
              <span className="flex items-center gap-1 truncate">
                <User className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{voucher.recipient_name}</span>
              </span>
            )}
            {voucher.expires_at && (
              <span className="flex-shrink-0">
                Exp{" "}
                {new Date(voucher.expires_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "2-digit",
                })}
              </span>
            )}
          </div>
        </div>

        <ChevronRight className="h-5 w-5 text-gray-600 group-hover:text-gray-400 transition-colors flex-shrink-0" />
      </div>
    </button>
  );
}
