"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Gift,
  Plus,
  Mail,
  Check,
  X,
  Coffee,
  DollarSign,
  Percent,
  ChevronDown,
  Calendar,
  User,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { useCartStore } from "@/lib/store/cart-store";

type VoucherType = "amount" | "item" | "percent";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);

interface VoucherCreateModalProps {
  items: any[];
  onClose: () => void;
  onCreated: (voucher: any) => void;
}

export function VoucherCreateModal({ items, onClose, onCreated }: VoucherCreateModalProps) {
  const router = useRouter();
  const { addLine } = useCartStore();

  const [voucherType, setVoucherType] = useState<VoucherType>("amount");
  const [amount, setAmount] = useState("");
  const [percentDiscount, setPercentDiscount] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedItemName, setSelectedItemName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 12);
    return d.toISOString().split("T")[0];
  });
  const [expiryMode, setExpiryMode] = useState<"3m" | "6m" | "12m" | "custom" | "none">("12m");
  const [message, setMessage] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const isFormValid = () => {
    if (voucherType === "amount") return !!amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0;
    if (voucherType === "percent") return !!percentDiscount && !isNaN(parseFloat(percentDiscount)) && parseFloat(percentDiscount) > 0 && parseFloat(percentDiscount) <= 100;
    if (voucherType === "item") return !!selectedItemId;
    return false;
  };

  const resetForm = () => {
    setVoucherType("amount");
    setAmount("");
    setPercentDiscount("");
    setSelectedItemId("");
    setSelectedItemName("");
    setRecipientName("");
    setRecipientEmail("");
    const d12 = new Date();
    d12.setMonth(d12.getMonth() + 12);
    setExpiryDate(d12.toISOString().split("T")[0]);
    setMessage("");
    setSendEmail(false);
    setItemSearch("");
    setExpiryMode("12m");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreate = async () => {
    if (!isFormValid()) return;
    setCreating(true);
    setError(null);
    try {
      if (voucherType === "amount") {
        const voucherAmount = parseFloat(amount);
        const config = {
          voucherType,
          amount,
          recipientName: recipientName || null,
          recipientEmail: recipientEmail || null,
          expiryDate: expiryDate || null,
          message: message || null,
          sendEmail: sendEmail && !!recipientEmail,
        };
        sessionStorage.setItem("pending_voucher_create", JSON.stringify(config));

        addLine({
          item_id: "gift_voucher",
          item_name: `Gift Voucher ${formatCurrency(voucherAmount)}${recipientName ? ` (${recipientName})` : ""}`,
          variant_id: null,
          variant_name: null,
          quantity: 1,
          unit_price: voucherAmount,
          modifiers: [],
          notes: message || "",
          tax_rate: 0,
        });

        handleClose();
        router.push("/payment");
        return;
      }

      const body: any = {
        voucher_type: voucherType,
        recipient_name: recipientName || null,
        recipient_email: recipientEmail || null,
        expires_at: expiryDate ? new Date(expiryDate).toISOString() : null,
        message: message || null,
        send_email: sendEmail && !!recipientEmail,
      };

      if (voucherType === "percent") body.percent_discount = parseFloat(percentDiscount);
      if (voucherType === "item") {
        body.item_id = selectedItemId;
        body.item_name = selectedItemName;
      }

      const sessionData =
        sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      const res = await fetch("/api/vouchers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionData ? { "x-pos-session": sessionData } : {}),
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        onCreated(data.voucher);
        resetForm();
        onClose();
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || "Failed to create voucher");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const previewLabel = useMemo(() => {
    if (voucherType === "amount") return formatCurrency(parseFloat(amount) || 0);
    if (voucherType === "percent") return `${percentDiscount || 0}% OFF`;
    if (voucherType === "item") return selectedItemName || "Free Item";
    return "";
  }, [voucherType, amount, percentDiscount, selectedItemName]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#3d3d3d] w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 duration-300">
        {/* Header with gradient */}
        <div className="relative px-5 py-4 border-b border-gray-700 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-penkey-orange/20 to-transparent">
          <div className="flex items-center gap-3">
            <div className="bg-penkey-orange/20 rounded-xl p-2">
              <Gift className="h-6 w-6 text-penkey-orange" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Create Voucher</h2>
              <p className="text-xs text-gray-400">Design a gift voucher for your customer</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-0">
            {/* Form section */}
            <div className="p-5 space-y-5">
              {/* Type selector - card style */}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2.5 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-penkey-orange" />
                  Voucher Type
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      { type: "amount" as VoucherType, icon: DollarSign, label: "£ Value", desc: "Fixed amount" },
                      { type: "item" as VoucherType, icon: Coffee, label: "Free Item", desc: "Specific item" },
                      { type: "percent" as VoucherType, icon: Percent, label: "% Off", desc: "Percentage off" },
                    ]
                  ).map(({ type, icon: Icon, label, desc }) => (
                    <button
                      key={type}
                      onClick={() => setVoucherType(type)}
                      className={`py-3 px-2 rounded-xl flex flex-col items-center gap-1.5 border-2 transition-all duration-200 ${
                        voucherType === type
                          ? "border-penkey-orange bg-gradient-to-br from-penkey-orange/20 to-penkey-orange/5 text-penkey-orange scale-[1.02]"
                          : "border-gray-600/50 bg-[#2d2d2d] text-gray-400 hover:border-gray-500 hover:text-gray-300"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-sm font-semibold">{label}</span>
                      <span className="text-[10px] opacity-70">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Value input */}
              {voucherType === "amount" && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-sm font-medium text-gray-300 mb-2 block">Amount (£)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-penkey-orange">£</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-[#2d2d2d] text-white pl-10 pr-4 py-3.5 rounded-xl border border-gray-600 focus:outline-none focus:border-penkey-orange focus:ring-1 focus:ring-penkey-orange/30 text-2xl font-bold transition-all"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex gap-2 mt-2.5">
                    {[5, 10, 20, 50].map((v) => (
                      <button
                        key={v}
                        onClick={() => setAmount(String(v))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                          amount === String(v)
                            ? "border-penkey-orange bg-penkey-orange/15 text-penkey-orange"
                            : "border-gray-600/50 bg-[#2d2d2d] text-gray-400 hover:border-gray-500"
                        }`}
                      >
                        £{v}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {voucherType === "percent" && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-sm font-medium text-gray-300 mb-2 block">Discount (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      value={percentDiscount}
                      onChange={(e) => setPercentDiscount(e.target.value)}
                      className="w-full bg-[#2d2d2d] text-white pl-4 pr-10 py-3.5 rounded-xl border border-gray-600 focus:outline-none focus:border-penkey-orange focus:ring-1 focus:ring-penkey-orange/30 text-2xl font-bold transition-all"
                      placeholder="10"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-penkey-orange">%</span>
                  </div>
                  <div className="flex gap-2 mt-2.5">
                    {[10, 15, 20, 25].map((v) => (
                      <button
                        key={v}
                        onClick={() => setPercentDiscount(String(v))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                          percentDiscount === String(v)
                            ? "border-penkey-orange bg-penkey-orange/15 text-penkey-orange"
                            : "border-gray-600/50 bg-[#2d2d2d] text-gray-400 hover:border-gray-500"
                        }`}
                      >
                        {v}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {voucherType === "item" && (
                <div className="relative animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-sm font-medium text-gray-300 mb-2 block">Select Item</label>
                  <button
                    onClick={() => setShowItemDropdown(!showItemDropdown)}
                    className="w-full bg-[#2d2d2d] text-left px-4 py-3.5 rounded-xl border border-gray-600 hover:border-penkey-orange flex items-center justify-between transition-all"
                  >
                    <span className={selectedItemName ? "text-white font-medium" : "text-gray-500"}>
                      {selectedItemName || "Choose an item..."}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-gray-400 transition-transform ${showItemDropdown ? "rotate-180" : ""}`}
                    />
                  </button>
                  {showItemDropdown && (
                    <div className="absolute z-20 w-full bg-[#4d4d4d] border border-gray-600 rounded-xl mt-1.5 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="p-2.5 border-b border-gray-600">
                        <input
                          type="text"
                          placeholder="Search items..."
                          value={itemSearch}
                          onChange={(e) => setItemSearch(e.target.value)}
                          className="w-full bg-[#3d3d3d] text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-penkey-orange/30"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        {filteredItems.slice(0, 30).map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              setSelectedItemId(item.id);
                              setSelectedItemName(item.name);
                              setShowItemDropdown(false);
                              setItemSearch("");
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-white/10 flex justify-between items-center transition-colors"
                          >
                            <span className="text-sm">{item.name}</span>
                            <span className="text-xs text-gray-400">{formatCurrency(item.price)}</span>
                          </button>
                        ))}
                        {filteredItems.length === 0 && (
                          <div className="px-4 py-3 text-sm text-gray-400">No items found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Recipient section */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-gray-500" />
                    Recipient Name <span className="text-gray-500 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. Jane Smith"
                    className="w-full bg-[#2d2d2d] text-white px-4 py-3 rounded-xl border border-gray-600 focus:outline-none focus:border-penkey-orange focus:ring-1 focus:ring-penkey-orange/30 transition-all"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-gray-500" />
                    Recipient Email <span className="text-gray-500 font-normal">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full bg-[#2d2d2d] text-white px-4 py-3 rounded-xl border border-gray-600 focus:outline-none focus:border-penkey-orange focus:ring-1 focus:ring-penkey-orange/30 transition-all"
                  />
                </div>
              </div>

              {/* Expiry */}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-gray-500" />
                  Expiry
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {(["3m", "6m", "12m", "custom"] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => {
                        setExpiryMode(opt);
                        if (opt !== "custom") {
                          const d = new Date();
                          if (opt === "3m") d.setMonth(d.getMonth() + 3);
                          if (opt === "6m") d.setMonth(d.getMonth() + 6);
                          if (opt === "12m") d.setMonth(d.getMonth() + 12);
                          setExpiryDate(d.toISOString().split("T")[0]);
                        } else {
                          setExpiryDate("");
                        }
                      }}
                      className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                        expiryMode === opt
                          ? "border-penkey-orange bg-penkey-orange/10 text-penkey-orange"
                          : "border-gray-600/50 bg-[#2d2d2d] text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      {opt === "3m" ? "3 Mo" : opt === "6m" ? "6 Mo" : opt === "12m" ? "12 Mo" : "Custom"}
                    </button>
                  ))}
                </div>
                {expiryMode === "custom" && (
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full bg-[#2d2d2d] text-white px-4 py-3 rounded-xl border border-gray-600 focus:outline-none focus:border-penkey-orange transition-all"
                  />
                )}
                {expiryDate && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    Expires:{" "}
                    {new Date(expiryDate).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                )}
              </div>

              {/* Message */}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-gray-500" />
                  Personal Message <span className="text-gray-500 font-normal">(optional)</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="With love from..."
                  rows={2}
                  className="w-full bg-[#2d2d2d] text-white px-4 py-3 rounded-xl border border-gray-600 focus:outline-none focus:border-penkey-orange focus:ring-1 focus:ring-penkey-orange/30 resize-none transition-all"
                />
              </div>

              {/* Send email toggle */}
              {recipientEmail && (
                <button
                  onClick={() => setSendEmail(!sendEmail)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                    sendEmail
                      ? "border-penkey-orange bg-penkey-orange/10"
                      : "border-gray-600/50 bg-[#2d2d2d]"
                  }`}
                >
                  <Mail className="h-5 w-5 flex-shrink-0 text-penkey-orange" />
                  <span className="flex-1 text-left text-sm font-medium">
                    Send voucher by email to {recipientEmail}
                  </span>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      sendEmail ? "bg-penkey-orange border-penkey-orange" : "border-gray-500"
                    }`}
                  >
                    {sendEmail && <Check className="h-3 w-3 text-white" />}
                  </div>
                </button>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}
            </div>

            {/* Live Preview - sticky on desktop, inline on mobile */}
            <div className="lg:border-l border-gray-700 bg-[#2d2d2d]/50 p-5 lg:sticky lg:top-0">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                Live Preview
              </div>
              <VoucherPreview
                type={voucherType}
                label={previewLabel}
                recipientName={recipientName}
                message={message}
                expiryDate={expiryDate}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex-shrink-0 bg-[#3d3d3d]">
          <button
            onClick={handleCreate}
            disabled={creating || !isFormValid()}
            className="w-full py-4 bg-gradient-to-r from-penkey-orange to-orange-600 hover:from-penkey-orange/90 hover:to-orange-600/90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            {creating ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
                Creating...
              </>
            ) : (
              <>
                <Gift className="h-5 w-5" />
                {voucherType === "amount" ? "Continue to Payment" : "Create Voucher"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function VoucherPreview({
  type,
  label,
  recipientName,
  message,
  expiryDate,
}: {
  type: VoucherType;
  label: string;
  recipientName: string;
  message: string;
  expiryDate: string;
}) {
  const typeIcon = type === "amount" ? DollarSign : type === "item" ? Coffee : Percent;
  const Icon = typeIcon;
  const gradient =
    type === "amount"
      ? "from-amber-500/20 to-orange-500/10"
      : type === "item"
      ? "from-blue-500/20 to-cyan-500/10"
      : "from-purple-500/20 to-pink-500/10";

  return (
    <div
      className={`rounded-2xl border border-gray-600/50 bg-gradient-to-br ${gradient} p-5 flex flex-col items-center text-center gap-3`}
    >
      <div className="bg-white/10 rounded-full p-2">
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div className="text-3xl font-bold text-white">{label}</div>
      {recipientName && (
        <div className="text-sm text-gray-300">
          For <span className="font-semibold text-white">{recipientName}</span>
        </div>
      )}
      {message && (
        <div className="text-xs italic text-gray-400 max-w-[200px] leading-relaxed">
          &ldquo;{message}&rdquo;
        </div>
      )}
      {expiryDate && (
        <div className="text-xs text-gray-500 mt-1">
          Valid until{" "}
          {new Date(expiryDate).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </div>
      )}
      <div className="text-[10px] text-gray-600 mt-2 uppercase tracking-wider">
        Penkey Delicaf & Gifts
      </div>
    </div>
  );
}
