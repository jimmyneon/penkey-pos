"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Printer,
  QrCode,
  X,
  Trash2,
  Ticket,
  Gift,
  ChevronRight,
} from "lucide-react";
import { useCartStore } from "@/lib/store/cart-store";

const STATUS_COLOURS: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border border-green-500/30",
  redeemed: "bg-gray-500/20 text-gray-400 border border-gray-500/30",
  expired: "bg-red-500/20 text-red-400 border border-red-500/30",
  cancelled: "bg-red-800/20 text-red-600 border border-red-800/30",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);

const voucherLabel = (v: any) => {
  if (v.voucher_type === "amount") return formatCurrency(v.amount || 0);
  if (v.voucher_type === "percent") return `${v.percent_discount || 0}% off`;
  if (v.voucher_type === "item") return `Free: ${v.item_name || "item"}`;
  return "—";
};

interface VoucherDetailModalProps {
  voucher: any;
  lines: any[];
  onClose: () => void;
  onDeleted: (id: string) => void;
}

export function VoucherDetailModal({ voucher, lines, onClose, onDeleted }: VoucherDetailModalProps) {
  const router = useRouter();
  const { applyVoucher, setBasketVoucher } = useCartStore();
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(0);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  const handleEmail = async () => {
    const email = voucher.recipient_email || prompt("Enter email address:");
    if (!email) return;
    setEmailingId(voucher.id);
    try {
      const sessionData =
        sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      await fetch(`/api/vouchers/${voucher.id}/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionData ? { "x-pos-session": sessionData } : {}),
        },
        body: JSON.stringify({ email }),
      });
    } finally {
      setEmailingId(null);
    }
  };

  const handlePrint = () => {
    window.open(`/api/vouchers/${voucher.id}/print?autoprint=1`, "_blank");
  };

  const handleDelete = async () => {
    if (deleteConfirmStep < 2) {
      setDeleteConfirmStep(deleteConfirmStep + 1);
      return;
    }
    setDeletingId(voucher.id);
    try {
      const sessionData =
        sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      const res = await fetch(`/api/vouchers/${voucher.id}`, {
        method: "DELETE",
        headers: {
          ...(sessionData ? { "x-pos-session": sessionData } : {}),
        },
      });
      if (res.ok) {
        onDeleted(voucher.id);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleRedeem = async () => {
    setRedeemingId(voucher.id);
    try {
      const sessionData =
        sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      const res = await fetch("/api/vouchers/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionData ? { "x-pos-session": sessionData } : {}),
        },
        body: JSON.stringify({ id: voucher.id, confirm: false }),
      });

      if (res.ok) {
        const data = await res.json();
        const voucherData = data.voucher;
        const voucherForCart = {
          id: voucherData.id,
          name: voucherData.name,
          discountType: voucherData.discountType as any,
          discountValue: voucherData.discountValue,
          beanCost: 0,
          itemType: voucherData.voucher_type === "item" ? "item" : undefined,
          category: undefined,
        };

        if (voucherData.discountType === "free_item") {
          const matchingLine = lines.find((line: any) =>
            line.item_name.toLowerCase().includes(voucherData.item_name?.toLowerCase() || "")
          );
          if (!matchingLine) {
            alert(`Add "${voucherData.item_name}" to the cart first, then redeem this voucher.`);
            return;
          }
          applyVoucher(matchingLine.id, voucherForCart);
        } else {
          setBasketVoucher(voucherForCart);
        }
        onClose();
        router.push("/sell");
      }
    } catch (err) {
      console.error("Failed to apply voucher:", err);
      alert("Failed to apply voucher. Please try again.");
    } finally {
      setRedeemingId(null);
    }
  };

  const handleClose = () => {
    setDeleteConfirmStep(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#3d3d3d] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 duration-300">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-penkey-orange/15 to-transparent">
          <div className="flex items-center gap-3">
            <div className="bg-penkey-orange/20 rounded-xl p-2">
              <Gift className="h-5 w-5 text-penkey-orange" />
            </div>
            <h2 className="text-lg font-bold">Voucher Details</h2>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Voucher code and value - hero card */}
          <div className="bg-gradient-to-br from-[#2d2d2d] to-[#252525] rounded-2xl p-5 border border-gray-700/50">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xl font-bold text-penkey-orange tracking-wider">
                {voucher.code}
              </span>
              <span
                className={`text-xs px-2.5 py-1 rounded-full capitalize font-medium ${
                  STATUS_COLOURS[voucher.status] || ""
                }`}
              >
                {voucher.status}
              </span>
            </div>
            <div className="text-3xl font-bold text-white">{voucherLabel(voucher)}</div>
          </div>

          {/* Info cards */}
          {voucher.recipient_name && (
            <div className="bg-[#2d2d2d] rounded-xl p-4 border border-gray-700/30">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Recipient</div>
              <div className="text-base font-semibold">{voucher.recipient_name}</div>
              {voucher.recipient_email && (
                <div className="text-sm text-gray-400 mt-0.5">{voucher.recipient_email}</div>
              )}
            </div>
          )}

          {voucher.expires_at && (
            <div className="bg-[#2d2d2d] rounded-xl p-4 border border-gray-700/30">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Valid Until</div>
              <div className="text-base font-semibold">
                {new Date(voucher.expires_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>
          )}

          {voucher.message && (
            <div className="bg-[#2d2d2d] rounded-xl p-4 border border-gray-700/30">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Message</div>
              <div className="text-base italic text-gray-300 leading-relaxed">
                &ldquo;{voucher.message}&rdquo;
              </div>
            </div>
          )}

          {/* QR Code */}
          <div className="bg-[#2d2d2d] rounded-xl p-5 border border-gray-700/30 flex flex-col items-center">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Scan to Redeem</div>
            <div className="bg-white p-3 rounded-xl">
              <QrCode className="h-28 w-28 text-black" />
            </div>
            <div className="text-xs text-gray-500 mt-2 font-mono">{voucher.code}</div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-gray-700 flex-shrink-0 space-y-2 bg-[#3d3d3d]">
          {voucher.status === "active" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleEmail}
                  disabled={emailingId === voucher.id}
                  className="py-3 bg-[#4d4d4d] hover:bg-[#5d5d5d] disabled:opacity-50 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  {emailingId === voucher.id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Email
                    </>
                  )}
                </button>
                <button
                  onClick={handlePrint}
                  className="py-3 bg-[#4d4d4d] hover:bg-[#5d5d5d] text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
              </div>
              <button
                onClick={handleRedeem}
                disabled={redeemingId === voucher.id}
                className="w-full py-3.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-600/90 hover:to-green-700/90 disabled:opacity-50 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                {redeemingId === voucher.id ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                ) : (
                  <>
                    <Ticket className="h-4 w-4" />
                    Redeem Voucher
                  </>
                )}
              </button>
            </>
          )}
          <button
            onClick={handleDelete}
            disabled={deletingId === voucher.id}
            className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm ${
              deleteConfirmStep === 0
                ? "bg-red-600/20 text-red-400 hover:bg-red-600/30"
                : deleteConfirmStep === 1
                ? "bg-red-700/30 text-red-300 hover:bg-red-700/40"
                : "bg-red-800 text-white"
            }`}
          >
            {deletingId === voucher.id ? (
              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                {deleteConfirmStep === 0
                  ? "Delete Voucher"
                  : deleteConfirmStep === 1
                  ? "Confirm Delete?"
                  : "FINAL CONFIRM — This cannot be undone"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
