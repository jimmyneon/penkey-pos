"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Gift,
  Plus,
  Search,
  Mail,
  Printer,
  QrCode,
  Check,
  X,
  Coffee,
  DollarSign,
  Percent,
  ChevronDown,
  Trash2,
  Ticket,
} from "lucide-react";
import { useCartStore } from "@/lib/store/cart-store";

type VoucherType = "amount" | "item" | "percent";

const STATUS_COLOURS: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border border-green-500/30",
  redeemed: "bg-gray-500/20 text-gray-400 border border-gray-500/30",
  expired: "bg-red-500/20 text-red-400 border border-red-500/30",
  cancelled: "bg-red-800/20 text-red-600 border border-red-800/30",
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
};

export default function VouchersPage() {
  const router = useRouter();
  const { lines, applyVoucher } = useCartStore();
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(0);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  // Create form state
  const [voucherType, setVoucherType] = useState<VoucherType>("amount");
  const [amount, setAmount] = useState("");
  const [percentDiscount, setPercentDiscount] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedItemName, setSelectedItemName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 12);
    return d.toISOString().split("T")[0];
  });
  const [expiryMode, setExpiryMode] = useState<"3m" | "6m" | "12m" | "custom" | "none">("12m");
  const [message, setMessage] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  useEffect(() => {
    console.log("[Vouchers] Component mounted");
    // Check for session and redirect if missing
    try {
      const session = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      console.log("[Vouchers] Session check:", !!session);
      if (!session) {
        console.log("[Vouchers] No session, redirecting to login");
        router.push("/login");
        return;
      }
      console.log("[Vouchers] Fetching vouchers and items");
      fetchVouchers();
      fetchItems();
    } catch (err) {
      console.error("[Vouchers] Session storage error:", err);
      router.push("/login");
    }
  }, [router]);

  const fetchVouchers = async () => {
    console.log("[Vouchers] fetchVouchers called");
    try {
      let sessionData;
      try {
        sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
        console.log("[Vouchers] Session data for fetch:", !!sessionData);
      } catch {
        sessionData = null;
        console.log("[Vouchers] Session storage error in fetchVouchers");
      }
      console.log("[Vouchers] Fetching /api/vouchers");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      const res = await fetch("/api/vouchers", {
        headers: sessionData ? { "x-pos-session": sessionData } : {},
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      console.log("[Vouchers] Vouchers response status:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("[Vouchers] Vouchers data received:", data.vouchers?.length);
        setVouchers(data.vouchers || []);
      } else {
        console.error("[Vouchers] Vouchers fetch failed:", res.status, res.statusText);
      }
    } catch (err: any) {
      console.error("[Vouchers] fetchVouchers error:", err);
      if (err.name === 'AbortError') {
        console.error("[Vouchers] Fetch aborted due to timeout");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    console.log("[Vouchers] fetchItems called");
    try {
      let sessionData;
      try {
        sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
        console.log("[Vouchers] Session data for items fetch:", !!sessionData);
      } catch {
        sessionData = null;
        console.log("[Vouchers] Session storage error in fetchItems");
      }
      console.log("[Vouchers] Fetching /api/items");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      const res = await fetch("/api/items?limit=200", {
        headers: sessionData ? { "x-pos-session": sessionData } : {},
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      console.log("[Vouchers] Items response status:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("[Vouchers] Items data received:", data.items?.length);
        setItems(data.items || []);
      } else {
        console.error("[Vouchers] Items fetch failed:", res.status, res.statusText);
      }
    } catch (err: any) {
      console.error("[Vouchers] fetchItems error:", err);
      if (err.name === 'AbortError') {
        console.error("[Vouchers] Fetch aborted due to timeout");
      }
    }
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const handleCreate = async () => {
    setCreating(true);
    try {
      const body: any = {
        voucher_type: voucherType,
        recipient_name: recipientName || null,
        recipient_email: recipientEmail || null,
        expires_at: expiryDate ? new Date(expiryDate).toISOString() : null,
        message: message || null,
        send_email: sendEmail && !!recipientEmail,
      };

      if (voucherType === "amount") body.amount = parseFloat(amount);
      if (voucherType === "percent") body.percent_discount = parseFloat(percentDiscount);
      if (voucherType === "item") {
        body.item_id = selectedItemId;
        body.item_name = selectedItemName;
      }

      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
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
        setVouchers((prev) => [data.voucher, ...prev]);
        resetForm();
        setShowCreate(false);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleEmail = async (voucher: any) => {
    const email = voucher.recipient_email || prompt("Enter email address:");
    if (!email) return;
    setEmailingId(voucher.id);
    try {
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
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

  const handlePrint = (voucher: any) => {
    window.open(`/api/vouchers/${voucher.id}/print?autoprint=1`, "_blank");
  };

  const handleDelete = async (voucher: any) => {
    if (deleteConfirmStep < 2) {
      setDeleteConfirmStep(deleteConfirmStep + 1);
      return;
    }

    setDeletingId(voucher.id);
    try {
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      const res = await fetch(`/api/vouchers/${voucher.id}`, {
        method: "DELETE",
        headers: {
          ...(sessionData ? { "x-pos-session": sessionData } : {}),
        },
      });

      if (res.ok) {
        setVouchers((prev) => prev.filter((v) => v.id !== voucher.id));
        setShowDetail(false);
        setSelectedVoucher(null);
        setDeleteConfirmStep(0);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleRedeem = async (voucher: any) => {
    setRedeemingId(voucher.id);
    try {
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
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

        // Apply voucher to cart
        if (lines.length === 0) {
          alert("Cart is empty. Add items before applying voucher.");
          return;
        }

        const voucherForCart = {
          id: voucherData.id,
          name: voucherData.name,
          discountType: voucherData.discountType,
          discountValue: voucherData.discountValue,
          beanCost: 0,
          itemType: voucherData.voucher_type === "item" ? "item" : undefined,
          category: undefined,
        };

        // For percentage/fixed discounts, apply to all lines (basket-level)
        // For free item, find matching line
        if (voucherData.discountType === "free_item") {
          const matchingLine = lines.find((line: any) =>
            line.item_name.toLowerCase().includes(voucherData.item_name?.toLowerCase() || "")
          );
          if (!matchingLine) {
            alert(`No matching item "${voucherData.item_name}" in cart.`);
            return;
          }
          applyVoucher(matchingLine.id, voucherForCart);
        } else {
          // Apply to all lines for percentage/fixed discounts
          lines.forEach((line: any) => {
            applyVoucher(line.id, voucherForCart);
          });
        }

        setShowDetail(false);
        setSelectedVoucher(null);
        router.push("/sell");
      }
    } catch (err) {
      console.error("Failed to apply voucher:", err);
      alert("Failed to apply voucher. Please try again.");
    } finally {
      setRedeemingId(null);
    }
  };

  const resetForm = () => {
    setVoucherType("amount");
    setAmount("");
    setPercentDiscount("");
    setSelectedItemId("");
    setSelectedItemName("");
    setRecipientName("");
    setRecipientEmail("");
    const d12 = new Date(); d12.setMonth(d12.getMonth() + 12);
    setExpiryDate(d12.toISOString().split("T")[0]);
    setMessage("");
    setSendEmail(false);
    setItemSearch("");
    setExpiryMode("12m");
  };

  const isFormValid = () => {
    if (voucherType === "amount") return !!amount && !isNaN(parseFloat(amount));
    if (voucherType === "percent") return !!percentDiscount && !isNaN(parseFloat(percentDiscount));
    if (voucherType === "item") return !!selectedItemId;
    return false;
  };

  const filtered = Array.isArray(vouchers) ? vouchers.filter((v) => {
    try {
      const fields = [v.code, v.recipient_name, v.recipient_email, v.item_name]
        .filter(Boolean)
        .map(f => String(f).toLowerCase());
      return fields.some((f) => f.includes(search.toLowerCase()));
    } catch {
      return false;
    }
  }) : [];

  const voucherLabel = (v: any) => {
    if (v.voucher_type === "amount") return formatCurrency(v.amount || 0);
    if (v.voucher_type === "percent") return `${v.percent_discount || 0}% off`;
    if (v.voucher_type === "item") return `Free: ${v.item_name || "item"}`;
    return "—";
  };

  return (
      <div className="min-h-screen bg-[#2d2d2d] flex flex-col text-white">
        {/* Header */}
        <header className="bg-[#3d3d3d] px-4 py-3 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/sell")} className="p-2 rounded-lg hover:bg-white/10">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold">Gift Vouchers</h1>
          </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-penkey-orange hover:bg-penkey-orange/90 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create
          </button>
        </div>
      </header>

      {/* Search */}
      <div className="px-4 py-3 border-b border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by code, name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#3d3d3d] text-white pl-10 pr-4 py-2.5 rounded-lg border border-gray-600 focus:outline-none focus:border-penkey-orange text-sm"
          />
        </div>
      </div>

      {/* Voucher list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-penkey-orange" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-400">
            <Gift className="h-16 w-16 opacity-30" />
            <p className="text-lg">No vouchers yet</p>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-penkey-orange text-white px-6 py-2 rounded-lg font-semibold"
            >
              Create your first voucher
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {filtered.map((voucher) => (
              <div
                key={voucher.id}
                onClick={() => { setSelectedVoucher(voucher); setShowDetail(true); }}
                className="px-4 py-4 cursor-pointer hover:bg-white/5 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono font-bold text-penkey-orange">{voucher.code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_COLOURS[voucher.status] || ""}`}>
                        {voucher.status}
                      </span>
                    </div>
                    <div className="text-lg font-semibold">{voucherLabel(voucher)}</div>
                    {voucher.recipient_name && (
                      <div className="text-sm text-gray-400">For: {voucher.recipient_name}</div>
                    )}
                    {voucher.expires_at && (
                      <div className="text-xs text-gray-500 mt-1">
                        Expires {new Date(voucher.expires_at).toLocaleDateString("en-GB")}
                      </div>
                    )}
                  </div>
                  <div className="text-gray-500">
                    <ChevronDown className="h-5 w-5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Voucher Detail Modal */}
      {showDetail && selectedVoucher && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#3d3d3d] w-full sm:max-w-lg sm:rounded-xl overflow-hidden flex flex-col max-h-[95vh]">
            {/* Modal header */}
            <div className="px-4 py-4 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
              <h2 className="text-xl font-bold">Voucher Details</h2>
              <button onClick={() => { setShowDetail(false); setSelectedVoucher(null); setDeleteConfirmStep(0); }} className="p-2 hover:bg-white/10 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {/* Voucher code and status */}
              <div className="bg-[#2d2d2d] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-2xl font-bold text-penkey-orange">{selectedVoucher.code}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_COLOURS[selectedVoucher.status] || ""}`}>
                    {selectedVoucher.status}
                  </span>
                </div>
                <div className="text-3xl font-bold text-white">{voucherLabel(selectedVoucher)}</div>
              </div>

              {/* Recipient info */}
              {selectedVoucher.recipient_name && (
                <div className="bg-[#2d2d2d] rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Recipient</div>
                  <div className="text-lg font-semibold">{selectedVoucher.recipient_name}</div>
                  {selectedVoucher.recipient_email && (
                    <div className="text-sm text-gray-400 mt-1">{selectedVoucher.recipient_email}</div>
                  )}
                </div>
              )}

              {/* Expiry */}
              {selectedVoucher.expires_at && (
                <div className="bg-[#2d2d2d] rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Valid Until</div>
                  <div className="text-lg font-semibold">
                    {new Date(selectedVoucher.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                </div>
              )}

              {/* Message */}
              {selectedVoucher.message && (
                <div className="bg-[#2d2d2d] rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Message</div>
                  <div className="text-lg italic text-gray-300">&ldquo;{selectedVoucher.message}&rdquo;</div>
                </div>
              )}

              {/* QR Code */}
              <div className="bg-[#2d2d2d] rounded-lg p-4 flex flex-col items-center">
                <div className="text-sm text-gray-400 mb-3">Scan to Redeem</div>
                <div className="bg-white p-3 rounded-lg">
                  <QrCode className="h-32 w-32 text-black" />
                </div>
                <div className="text-xs text-gray-500 mt-2">Code: {selectedVoucher.code}</div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="p-4 border-t border-gray-700 flex-shrink-0 space-y-2">
              {selectedVoucher.status === "active" && (
                <>
                  <button
                    onClick={() => handleEmail(selectedVoucher)}
                    disabled={emailingId === selectedVoucher.id}
                    className="w-full py-3 bg-[#4d4d4d] hover:bg-[#5d5d5d] disabled:opacity-50 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    {emailingId === selectedVoucher.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                    ) : (
                      <>
                        <Mail className="h-4 w-4" />
                        Email Voucher
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handlePrint(selectedVoucher)}
                    className="w-full py-3 bg-[#4d4d4d] hover:bg-[#5d5d5d] text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    Print Voucher
                  </button>
                  <button
                    onClick={() => handleRedeem(selectedVoucher)}
                    disabled={redeemingId === selectedVoucher.id}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    {redeemingId === selectedVoucher.id ? (
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
                onClick={() => handleDelete(selectedVoucher)}
                disabled={deletingId === selectedVoucher.id}
                className={`w-full py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                  deleteConfirmStep === 0
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : deleteConfirmStep === 1
                    ? "bg-red-700 hover:bg-red-800 text-white"
                    : "bg-red-800 text-white"
                }`}
              >
                {deletingId === selectedVoucher.id ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    {deleteConfirmStep === 0 ? "Delete Voucher" : deleteConfirmStep === 1 ? "Confirm Delete?" : "FINAL CONFIRM - This cannot be undone"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Voucher Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#3d3d3d] w-full sm:max-w-lg sm:rounded-xl overflow-hidden flex flex-col max-h-[95vh]">
            {/* Modal header */}
            <div className="px-4 py-4 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
              <h2 className="text-xl font-bold">Create Voucher</h2>
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="p-2 hover:bg-white/10 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {/* Type selector */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Voucher Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["amount", "item", "percent"] as VoucherType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setVoucherType(type)}
                      className={`py-3 rounded-lg flex flex-col items-center gap-1 text-sm font-semibold border-2 transition-colors ${
                        voucherType === type
                          ? "border-penkey-orange bg-penkey-orange/10 text-penkey-orange"
                          : "border-gray-600 bg-[#2d2d2d] text-gray-300 hover:border-gray-400"
                      }`}
                    >
                      {type === "amount" && <DollarSign className="h-5 w-5" />}
                      {type === "item" && <Coffee className="h-5 w-5" />}
                      {type === "percent" && <Percent className="h-5 w-5" />}
                      <span className="capitalize">{type === "amount" ? "£ Value" : type === "item" ? "Free Item" : "% Off"}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Value input */}
              {voucherType === "amount" && (
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Amount (£)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-bold text-penkey-orange">£</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={amount} onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-[#2d2d2d] text-white pl-8 pr-4 py-3 rounded-lg border border-gray-600 focus:outline-none focus:border-penkey-orange text-xl font-bold"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    {[5, 10, 20, 50].map((v) => (
                      <button key={v} onClick={() => setAmount(String(v))}
                        className="flex-1 py-2 bg-[#2d2d2d] border border-gray-600 hover:border-penkey-orange text-sm rounded-lg transition-colors">
                        £{v}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {voucherType === "percent" && (
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Discount (%)</label>
                  <div className="relative">
                    <input
                      type="number" min="1" max="100" step="1"
                      value={percentDiscount} onChange={(e) => setPercentDiscount(e.target.value)}
                      className="w-full bg-[#2d2d2d] text-white pl-4 pr-8 py-3 rounded-lg border border-gray-600 focus:outline-none focus:border-penkey-orange text-xl font-bold"
                      placeholder="10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xl font-bold text-penkey-orange">%</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {[10, 15, 20, 25].map((v) => (
                      <button key={v} onClick={() => setPercentDiscount(String(v))}
                        className="flex-1 py-2 bg-[#2d2d2d] border border-gray-600 hover:border-penkey-orange text-sm rounded-lg transition-colors">
                        {v}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {voucherType === "item" && (
                <div className="relative">
                  <label className="text-sm text-gray-400 mb-2 block">Select Item</label>
                  <button
                    onClick={() => setShowItemDropdown(!showItemDropdown)}
                    className="w-full bg-[#2d2d2d] text-left px-4 py-3 rounded-lg border border-gray-600 hover:border-penkey-orange flex items-center justify-between transition-colors"
                  >
                    <span className={selectedItemName ? "text-white" : "text-gray-400"}>
                      {selectedItemName || "Choose an item..."}
                    </span>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </button>
                  {showItemDropdown && (
                    <div className="absolute z-10 w-full bg-[#4d4d4d] border border-gray-600 rounded-lg mt-1 shadow-xl">
                      <div className="p-2 border-b border-gray-600">
                        <input
                          type="text" placeholder="Search items..."
                          value={itemSearch} onChange={(e) => setItemSearch(e.target.value)}
                          className="w-full bg-[#3d3d3d] text-white px-3 py-2 rounded-lg text-sm focus:outline-none"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredItems.slice(0, 30).map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              setSelectedItemId(item.id);
                              setSelectedItemName(item.name);
                              setShowItemDropdown(false);
                              setItemSearch("");
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-white/10 flex justify-between items-center"
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

              {/* Recipient */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Recipient Name (optional)</label>
                <input
                  type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. Jane Smith"
                  className="w-full bg-[#2d2d2d] text-white px-4 py-3 rounded-lg border border-gray-600 focus:outline-none focus:border-penkey-orange"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Recipient Email (optional)</label>
                <input
                  type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full bg-[#2d2d2d] text-white px-4 py-3 rounded-lg border border-gray-600 focus:outline-none focus:border-penkey-orange"
                />
              </div>

              {/* Expiry */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Expiry</label>
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
                      className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${
                        expiryMode === opt
                          ? "border-penkey-orange bg-penkey-orange/10 text-penkey-orange"
                          : "border-gray-600 bg-[#2d2d2d] text-gray-300 hover:border-gray-400"
                      }`}
                    >
                      {opt === "3m" ? "3 Months" : opt === "6m" ? "6 Months" : opt === "12m" ? "12 Months" : "Custom"}
                    </button>
                  ))}
                </div>
                {expiryMode === "custom" && (
                  <input
                    type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full bg-[#2d2d2d] text-white px-4 py-3 rounded-lg border border-gray-600 focus:outline-none focus:border-penkey-orange"
                  />
                )}
                {expiryDate && (
                  <p className="text-xs text-gray-400 mt-1">
                    Expires: {new Date(expiryDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                )}
              </div>

              {/* Message */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Personal Message (optional)</label>
                <textarea
                  value={message} onChange={(e) => setMessage(e.target.value)}
                  placeholder="With love from..."
                  rows={2}
                  className="w-full bg-[#2d2d2d] text-white px-4 py-3 rounded-lg border border-gray-600 focus:outline-none focus:border-penkey-orange resize-none"
                />
              </div>

              {/* Send email toggle */}
              {recipientEmail && (
                <button
                  onClick={() => setSendEmail(!sendEmail)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-colors ${
                    sendEmail ? "border-penkey-orange bg-penkey-orange/10" : "border-gray-600 bg-[#2d2d2d]"
                  }`}
                >
                  <Mail className="h-5 w-5 flex-shrink-0" />
                  <span className="flex-1 text-left text-sm font-medium">Send voucher by email</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${sendEmail ? "bg-penkey-orange border-penkey-orange" : "border-gray-500"}`}>
                    {sendEmail && <Check className="h-3 w-3 text-white" />}
                  </div>
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-700 flex-shrink-0 space-y-2">
              <button
                onClick={handleCreate}
                disabled={creating || !isFormValid()}
                className="w-full py-4 bg-penkey-orange hover:bg-penkey-orange/90 disabled:opacity-40 text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
              >
                {creating ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
                ) : (
                  <>
                    <Gift className="h-5 w-5" />
                    Create Voucher
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
