"use client";

import { useState } from "react";
import { Tag, CheckCircle2, AlertCircle, X, Loader2 } from "lucide-react";

interface VoucherResult {
  id: string;
  code: string;
  name: string;
  discountType: "fixed" | "percentage" | "free_item";
  discountValue: number;
  recipient_name?: string;
  voucher_type: string;
  item_name?: string;
}

interface VoucherRedeemDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (voucher: VoucherResult) => void;
}

export function VoucherRedeemDialog({ open, onClose, onApply }: VoucherRedeemDialogProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VoucherResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleLookup = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      const res = await fetch("/api/vouchers/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionData ? { "x-pos-session": sessionData } : {}),
        },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid voucher");
      } else {
        setResult(data.voucher);
      }
    } catch {
      setError("Failed to check voucher. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    onApply(result);
    setCode("");
    setResult(null);
    setError(null);
    onClose();
  };

  const handleClose = () => {
    setCode("");
    setResult(null);
    setError(null);
    onClose();
  };

  const valueLabel =
    result?.discountType === "fixed" ? `£${result.discountValue.toFixed(2)} off`
    : result?.discountType === "percentage" ? `${result.discountValue}% off`
    : `Free: ${result?.item_name}`;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#3d3d3d] rounded-xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-penkey-orange" />
            <h2 className="text-lg font-bold text-white">Redeem Voucher</h2>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Code input */}
          <div>
            <label className="text-sm text-gray-400 block mb-2">Voucher Code</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                  setResult(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                placeholder="PNK-XXXX-XXXX"
                className="flex-1 bg-[#2d2d2d] text-white px-4 py-3 rounded-lg border border-gray-600 focus:outline-none focus:border-penkey-orange font-mono text-lg tracking-widest uppercase"
                autoFocus
              />
              <button
                onClick={handleLookup}
                disabled={loading || !code.trim()}
                className="px-4 py-3 bg-penkey-orange hover:bg-penkey-orange/90 disabled:opacity-40 text-white rounded-lg font-semibold transition-colors"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Check"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Valid voucher preview */}
          {result && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />
                <span className="text-green-400 font-semibold">Valid Voucher</span>
              </div>
              <div className="text-white">
                <p className="text-xl font-bold text-penkey-orange">{valueLabel}</p>
                <p className="text-sm text-gray-400 mt-1">{result.code}</p>
                {result.recipient_name && (
                  <p className="text-sm text-gray-300 mt-0.5">For: {result.recipient_name}</p>
                )}
              </div>
              <p className="text-xs text-gray-400">
                {result.discountType === "free_item"
                  ? "Apply to the matching item line in the basket."
                  : "This discount will be applied to the entire basket."}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-3 bg-[#2d2d2d] hover:bg-[#4d4d4d] text-white rounded-lg font-semibold transition-colors border border-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!result}
            className="flex-1 py-3 bg-penkey-orange hover:bg-penkey-orange/90 disabled:opacity-40 text-white rounded-lg font-semibold transition-colors"
          >
            Apply to Basket
          </button>
        </div>
      </div>
    </div>
  );
}
