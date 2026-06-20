"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import {
  Mail,
  Printer,
  QrCode,
  X,
  Trash2,
  Ticket,
  Gift,
} from "lucide-react";
import { useCartStore } from "@/lib/store/cart-store";
import { hapticButtonPress } from "@/lib/utils/haptics";

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
  onEmailed?: () => void;
  onRedeemed?: () => void;
}

export function VoucherDetailModal({ voucher, lines, onClose, onDeleted, onEmailed, onRedeemed }: VoucherDetailModalProps) {
  const router = useRouter();
  const { applyVoucher, setBasketVoucher } = useCartStore();
  const [emailing, setEmailing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(0);
  const [redeeming, setRedeeming] = useState(false);

  const handleEmail = async () => {
    const email = voucher.recipient_email || prompt("Enter email address:");
    if (!email) return;
    setEmailing(true);
    try {
      const sessionData =
        sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      const res = await fetch(`/api/vouchers/${voucher.id}/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionData ? { "x-pos-session": sessionData } : {}),
        },
        body: JSON.stringify({ email }),
      });
      if (res.ok && onEmailed) onEmailed();
    } finally {
      setEmailing(false);
    }
  };

  const handlePrint = () => {
    hapticButtonPress();
    window.open(`/api/vouchers/${voucher.id}/print?autoprint=1`, "_blank");
  };

  const handleDelete = async () => {
    if (deleteConfirmStep < 2) {
      hapticButtonPress();
      setDeleteConfirmStep(deleteConfirmStep + 1);
      return;
    }
    setDeleting(true);
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
      setDeleting(false);
    }
  };

  const handleRedeem = async () => {
    hapticButtonPress();
    setRedeeming(true);
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
        const v = data.voucher;
        const voucherForCart = {
          id: v.id,
          name: v.name,
          discountType: v.discountType as any,
          discountValue: v.discountValue,
          beanCost: 0,
          itemType: v.voucher_type === "item" ? "item" : undefined,
          category: undefined,
        };

        if (v.discountType === "free_item") {
          const matchingLine = lines.find((line: any) =>
            line.item_name.toLowerCase().includes(v.item_name?.toLowerCase() || "")
          );
          if (!matchingLine) {
            alert(`Add "${v.item_name}" to the cart first, then redeem this voucher.`);
            return;
          }
          applyVoucher(matchingLine.id, voucherForCart);
        } else {
          setBasketVoucher(voucherForCart);
        }
        if (onRedeemed) onRedeemed();
        onClose();
        router.push("/sell");
      }
    } catch (err) {
      console.error("Failed to apply voucher:", err);
      alert("Failed to apply voucher. Please try again.");
    } finally {
      setRedeeming(false);
    }
  };

  const handleClose = () => {
    setDeleteConfirmStep(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#3d3d3d] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-penkey-orange" />
            <h2 className="text-lg font-semibold text-white">Voucher Details</h2>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClose}
            className="text-white hover:bg-white/10 p-2"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {/* Voucher code and value */}
          <div className="bg-[#2d2d2d] rounded-xl p-4 border border-gray-700/50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-lg font-bold text-penkey-orange tracking-wider">
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
            <div className="text-2xl font-bold text-white">{voucherLabel(voucher)}</div>
          </div>

          {/* Info rows */}
          {voucher.recipient_name && (
            <div className="bg-[#2d2d2d] rounded-xl p-3.5 border border-gray-700/30">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Recipient</div>
              <div className="text-sm font-semibold text-white">{voucher.recipient_name}</div>
              {voucher.recipient_email && (
                <div className="text-xs text-gray-400 mt-0.5">{voucher.recipient_email}</div>
              )}
            </div>
          )}

          {voucher.expires_at && (
            <div className="bg-[#2d2d2d] rounded-xl p-3.5 border border-gray-700/30">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Valid Until</div>
              <div className="text-sm font-semibold text-white">
                {new Date(voucher.expires_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>
          )}

          {voucher.message && (
            <div className="bg-[#2d2d2d] rounded-xl p-3.5 border border-gray-700/30">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Message</div>
              <div className="text-sm italic text-gray-300 leading-relaxed">
                &ldquo;{voucher.message}&rdquo;
              </div>
            </div>
          )}

          {/* QR Code */}
          <div className="bg-[#2d2d2d] rounded-xl p-4 border border-gray-700/30 flex flex-col items-center">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Scan to Redeem</div>
            <div className="bg-white p-2.5 rounded-lg">
              <QrCode className="h-24 w-24 text-black" />
            </div>
            <div className="text-xs text-gray-500 mt-2 font-mono">{voucher.code}</div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-3 border-t border-gray-700 flex-shrink-0 space-y-2">
          {voucher.status === "active" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleEmail}
                  disabled={emailing}
                  className="bg-[#4d4d4d] hover:bg-[#5d5d5d] disabled:opacity-50 text-white border border-gray-600 h-10 flex items-center justify-center gap-2"
                >
                  {emailing ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Email
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handlePrint}
                  className="bg-[#4d4d4d] hover:bg-[#5d5d5d] text-white border border-gray-600 h-10 flex items-center justify-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
              </div>
              <Button
                onClick={handleRedeem}
                disabled={redeeming}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold h-11 flex items-center justify-center gap-2"
              >
                {redeeming ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                ) : (
                  <>
                    <Ticket className="h-4 w-4" />
                    Redeem Voucher
                  </>
                )}
              </Button>
            </>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`w-full py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm ${
              deleteConfirmStep === 0
                ? "bg-red-600/20 text-red-400 hover:bg-red-600/30"
                : deleteConfirmStep === 1
                ? "bg-red-700/30 text-red-300 hover:bg-red-700/40"
                : "bg-red-800 text-white"
            }`}
          >
            {deleting ? (
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
