"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import {
  Gift,
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
  SlidersHorizontal,
  QrCode,
} from "lucide-react";
import { useCartStore } from "@/lib/store/cart-store";
import { hapticButtonPress } from "@/lib/utils/haptics";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { VoucherSvgPreview, VoucherPreviewData } from "@/components/vouchers/VoucherSvgPreview";
import { VoucherTemplateEditor } from "@/components/vouchers/VoucherTemplateEditor";
import { DEFAULT_VOUCHER_LAYOUT, VoucherLayoutConfig, VoucherTemplate, DEFAULT_VOUCHER_TEMPLATE } from "@/lib/voucher/voucher-layout-config";

type VoucherType = "amount" | "item" | "percent";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);

interface VoucherCreateModalProps {
  items: any[];
  categories: any[];
  onClose: () => void;
  onCreated: (vouchers: any[]) => void;
}

export function VoucherCreateModal({ items, categories, onClose, onCreated }: VoucherCreateModalProps) {
  const router = useRouter();
  const { addLine } = useCartStore();

  useScrollLock(true);

  const [voucherType, setVoucherType] = useState<VoucherType>("amount");
  const [amount, setAmount] = useState("");
  const [isPromotional, setIsPromotional] = useState(false);
  const [percentDiscount, setPercentDiscount] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedItemName, setSelectedItemName] = useState("");
  const [itemSelectionType, setItemSelectionType] = useState<"single" | "multiple" | "category">("single");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedCategoryName, setSelectedCategoryName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 12);
    return d.toISOString().split("T")[0];
  });
  const [expiryMode, setExpiryMode] = useState<"3m" | "6m" | "12m" | "custom">("12m");
  const [message, setMessage] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [batchLabel, setBatchLabel] = useState("");
  const [voucherTitle, setVoucherTitle] = useState("");
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [customCode, setCustomCode] = useState("");
  const [minSpend, setMinSpend] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLayoutEditor, setShowLayoutEditor] = useState(false);
  const [voucherLayout, setVoucherLayout] = useState<VoucherLayoutConfig>(DEFAULT_VOUCHER_LAYOUT);
  const [savingLayout, setSavingLayout] = useState(false);
  const [templates, setTemplates] = useState<VoucherTemplate[]>([DEFAULT_VOUCHER_TEMPLATE]);
  const [activeTemplateId, setActiveTemplateId] = useState<string>('default');

  // Load saved templates on mount
  useEffect(() => {
    const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
    fetch("/api/voucher-template-settings", {
      headers: sessionData ? { "x-pos-session": sessionData } : {},
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.templates) {
          setTemplates(data.templates);
          const activeId = data.activeTemplateId || 'default';
          setActiveTemplateId(activeId);
          const active = data.templates.find((t: VoucherTemplate) => t.id === activeId);
          if (active) setVoucherLayout(active.layout);
        } else if (data.layout) {
          // Backwards compat: old single-layout format
          setVoucherLayout(data.layout);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveLayout = async (): Promise<boolean> => {
    setSavingLayout(true);
    try {
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      const activeTemplate = templates.find((t) => t.id === activeTemplateId) || templates[0];
      const res = await fetch("/api/voucher-template-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionData ? { "x-pos-session": sessionData } : {}),
        },
        body: JSON.stringify({
          template: {
            ...activeTemplate,
            layout: voucherLayout,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      if (data.templates) setTemplates(data.templates);
      return true;
    } catch {
      setError("Failed to save layout");
      return false;
    } finally {
      setSavingLayout(false);
    }
  };

  const handleSelectTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    setActiveTemplateId(templateId);
    setVoucherLayout(tpl.layout);
    // Set active on server
    const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
    fetch("/api/voucher-template-settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionData ? { "x-pos-session": sessionData } : {}),
      },
      body: JSON.stringify({ action: 'setActive', templateId }),
    }).catch(() => {});
  };

  const handleCreateTemplate = (name: string, imageUrl: string) => {
    const newId = `tpl_${Date.now()}`;
    const newTemplate: VoucherTemplate = {
      id: newId,
      name,
      imageUrl,
      layout: { ...DEFAULT_VOUCHER_LAYOUT },
      createdAt: new Date().toISOString(),
    };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    setActiveTemplateId(newId);
    setVoucherLayout({ ...DEFAULT_VOUCHER_LAYOUT });
    // Save to server
    const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
    fetch("/api/voucher-template-settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionData ? { "x-pos-session": sessionData } : {}),
      },
      body: JSON.stringify({ template: newTemplate }),
    }).catch(() => {});
  };

  const handleDeleteTemplate = (templateId: string) => {
    const updated = templates.filter((t) => t.id !== templateId);
    setTemplates(updated);
    if (activeTemplateId === templateId) {
      setActiveTemplateId('default');
      const def = updated.find((t) => t.id === 'default');
      if (def) setVoucherLayout(def.layout);
    }
    // Delete on server
    const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
    fetch(`/api/voucher-template-settings?id=${templateId}`, {
      method: "DELETE",
      headers: sessionData ? { "x-pos-session": sessionData } : {},
    }).catch(() => {});
  };

  const handleUploadTemplateImage = async (file: File): Promise<string | null> => {
    try {
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/voucher-template-settings/upload', {
        method: 'POST',
        headers: sessionData ? { "x-pos-session": sessionData } : {},
        body: formData,
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.url || null;
    } catch {
      return null;
    }
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const isFormValid = () => {
    if (voucherType === "amount") return !!amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0;
    if (voucherType === "percent") return !!percentDiscount && !isNaN(parseFloat(percentDiscount)) && parseFloat(percentDiscount) > 0 && parseFloat(percentDiscount) <= 100;
    if (voucherType === "item") {
      if (itemSelectionType === "single") return !!selectedItemId;
      if (itemSelectionType === "multiple") return selectedItemIds.length > 0;
      if (itemSelectionType === "category") return selectedCategoryIds.length > 0;
    }
    return false;
  };

  const resetForm = () => {
    setVoucherType("amount");
    setAmount("");
    setPercentDiscount("");
    setSelectedItemId("");
    setSelectedItemName("");
    setItemSelectionType("single");
    setSelectedItemIds([]);
    setSelectedCategoryIds([]);
    setSelectedCategoryName("");
    setRecipientName("");
    setRecipientEmail("");
    const d12 = new Date();
    d12.setMonth(d12.getMonth() + 12);
    setExpiryDate(d12.toISOString().split("T")[0]);
    setMessage("");
    setSendEmail(false);
    setItemSearch("");
    setExpiryMode("12m");
    setQuantity(1);
    setBatchLabel("");
    setVoucherTitle("");
    setUseCustomCode(false);
    setCustomCode("");
    setMinSpend("");
    setIsPromotional(false);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreate = async () => {
    if (!isFormValid()) return;
    hapticButtonPress();
    setCreating(true);
    setError(null);
    try {
      if (voucherType === "amount" && !isPromotional) {
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
          category_id: null,
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

      if (voucherType === "amount") body.amount = parseFloat(amount);

      if (voucherType === "percent") body.percent_discount = parseFloat(percentDiscount);
      if (voucherType === "item") {
        body.item_selection_type = itemSelectionType;
        body.voucher_title = voucherTitle || null;
        if (itemSelectionType === "single") {
          body.item_id = selectedItemId;
          body.item_name = selectedItemName;
        } else if (itemSelectionType === "multiple") {
          body.item_ids = selectedItemIds;
          const selectedNames = items
            .filter((it: any) => selectedItemIds.includes(it.id))
            .map((it: any) => it.name);
          body.item_name = selectedNames.join(", ");
        } else if (itemSelectionType === "category") {
          body.category_ids = selectedCategoryIds;
          body.category_id = selectedCategoryIds.length === 1 ? selectedCategoryIds[0] : undefined;
          body.item_name = selectedCategoryName;
        }
      }
      if (quantity > 1) {
        body.quantity = quantity;
        body.batch_label = batchLabel || undefined;
      }

      if (useCustomCode && customCode.trim()) {
        body.custom_code = customCode.trim();
      }

      if ((voucherType === "amount" || voucherType === "percent") && minSpend) {
        body.min_spend = parseFloat(minSpend);
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
        if (data.vouchers) {
          onCreated(data.vouchers);
        } else {
          onCreated([data.voucher]);
        }
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

  const svgPreviewData: VoucherPreviewData = useMemo(() => ({
    code: "XXXX-XXXX",
    voucherType,
    amount: parseFloat(amount) || undefined,
    percentDiscount: parseFloat(percentDiscount) || undefined,
    itemName: selectedItemName || undefined,
    voucherTitle: voucherTitle || undefined,
    recipientName: recipientName || undefined,
    recipientEmail: recipientEmail || undefined,
    message: message || undefined,
    expiresAt: expiryDate || undefined,
    storeName: "Penkey",
  }), [voucherType, amount, percentDiscount, selectedItemName, voucherTitle, recipientName, recipientEmail, message, expiryDate]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#3d3d3d] w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-penkey-orange" />
            <h2 className="text-lg font-semibold text-white">Create Voucher</h2>
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

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {/* Type selector */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-penkey-orange" />
              Voucher Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { type: "amount" as VoucherType, icon: DollarSign, label: "£ Value", desc: "Fixed amount" },
                  { type: "item" as VoucherType, icon: Coffee, label: "Free Item", desc: "Specific item" },
                  { type: "percent" as VoucherType, icon: Percent, label: "% Off", desc: "Percentage off" },
                ]
              ).map(({ type, icon: Icon, label, desc }) => (
                <button
                  key={type}
                  onClick={() => {
                    hapticButtonPress();
                    setVoucherType(type);
                  }}
                  className={`py-3 px-2 rounded-xl flex flex-col items-center gap-1 border-2 transition-colors ${
                    voucherType === type
                      ? "border-penkey-orange bg-penkey-orange/15 text-penkey-orange"
                      : "border-gray-600/50 bg-[#2d2d2d] text-gray-400 hover:border-gray-500"
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
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Amount (£)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-penkey-orange">£</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[#2d2d2d] text-white pl-10 pr-4 py-3.5 rounded-xl border border-gray-600 focus:outline-none focus:border-penkey-orange text-2xl font-bold"
                  placeholder="0.00"
                />
              </div>
              <div className="flex gap-2 mt-2">
                {[5, 10, 20, 50].map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      hapticButtonPress();
                      setAmount(String(v));
                    }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      amount === String(v)
                        ? "border-penkey-orange bg-penkey-orange/15 text-penkey-orange"
                        : "border-gray-600/50 bg-[#2d2d2d] text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    £{v}
                  </button>
                ))}
              </div>

              {/* Promotional voucher toggle */}
              <button
                onClick={() => {
                  hapticButtonPress();
                  setIsPromotional(!isPromotional);
                }}
                className={`w-full mt-3 flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                  isPromotional
                    ? "border-purple-500 bg-purple-500/10"
                    : "border-gray-600/50 bg-[#2d2d2d] hover:border-gray-500"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className={`h-4 w-4 ${isPromotional ? "text-purple-400" : "text-gray-500"}`} />
                  <span className={`text-sm font-medium ${isPromotional ? "text-purple-300" : "text-gray-400"}`}>
                    Promotional Voucher
                  </span>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors flex items-center ${isPromotional ? "bg-purple-500" : "bg-gray-600"}`}>
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${isPromotional ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
              </button>
              {isPromotional && (
                <p className="text-xs text-purple-400/70 mt-1.5 px-1">
                  No payment required — voucher is created for free as a promotion.
                </p>
              )}
            </div>
          )}

          {voucherType === "percent" && (
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Discount (%)</label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={percentDiscount}
                  onChange={(e) => setPercentDiscount(e.target.value)}
                  className="w-full bg-[#2d2d2d] text-white pl-4 pr-10 py-3.5 rounded-xl border border-gray-600 focus:outline-none focus:border-penkey-orange text-2xl font-bold"
                  placeholder="10"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-penkey-orange">%</span>
              </div>
              <div className="flex gap-2 mt-2">
                {[10, 15, 20, 25].map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      hapticButtonPress();
                      setPercentDiscount(String(v));
                    }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
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

          {/* Minimum spend condition - for amount & percent vouchers */}
          {(voucherType === "amount" || voucherType === "percent") && (
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-penkey-orange" />
                Minimum Spend
                <span className="text-gray-500 font-normal">(optional condition)</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-penkey-orange">£</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={minSpend}
                  onChange={(e) => setMinSpend(e.target.value)}
                  className="w-full bg-[#2d2d2d] text-white pl-10 pr-4 py-3 rounded-xl border border-gray-600 focus:outline-none focus:border-penkey-orange text-lg font-semibold"
                  placeholder="0.00 (no minimum)"
                />
              </div>
              {minSpend && parseFloat(minSpend) > 0 && (
                <p className="text-xs text-gray-500 mt-1.5">
                  Voucher only valid when cart total is over {formatCurrency(parseFloat(minSpend))}.
                </p>
              )}
            </div>
          )}

          {voucherType === "item" && (
            <div className="space-y-3">
              {/* Sub-selector: single / multiple / category */}
              <div className="grid grid-cols-3 gap-2">
                {([
                  { type: "single" as const, label: "Single", desc: "One item" },
                  { type: "multiple" as const, label: "Multiple", desc: "Pick items" },
                  { type: "category" as const, label: "Category", desc: "Whole category" },
                ]).map(({ type, label, desc }) => (
                  <button
                    key={type}
                    onClick={() => {
                      hapticButtonPress();
                      setItemSelectionType(type);
                      setShowItemDropdown(false);
                    }}
                    className={`py-2.5 px-2 rounded-lg flex flex-col items-center gap-0.5 border-2 transition-colors ${
                      itemSelectionType === type
                        ? "border-penkey-orange bg-penkey-orange/15 text-penkey-orange"
                        : "border-gray-600/50 bg-[#2d2d2d] text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    <span className="text-xs font-semibold">{label}</span>
                    <span className="text-[10px] opacity-70">{desc}</span>
                  </button>
                ))}
              </div>

              {/* Single item picker */}
              {itemSelectionType === "single" && (
                <div className="relative">
                  <button
                    onClick={() => setShowItemDropdown(!showItemDropdown)}
                    className="w-full bg-[#2d2d2d] text-left px-4 py-3.5 rounded-xl border border-gray-600 hover:border-penkey-orange flex items-center justify-between transition-colors"
                  >
                    <span className={selectedItemName ? "text-white font-medium" : "text-gray-500"}>
                      {selectedItemName || "Choose an item..."}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-gray-400 transition-transform ${showItemDropdown ? "rotate-180" : ""}`}
                    />
                  </button>
                  {showItemDropdown && (
                    <div className="absolute z-20 w-full bg-[#4d4d4d] border border-gray-600 rounded-xl mt-1.5 shadow-2xl">
                      <div className="p-2 border-b border-gray-600">
                        <input
                          type="text"
                          placeholder="Search items..."
                          value={itemSearch}
                          onChange={(e) => setItemSearch(e.target.value)}
                          className="w-full bg-[#3d3d3d] text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-penkey-orange/30"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredItems.slice(0, 30).map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              hapticButtonPress();
                              setSelectedItemId(item.id);
                              setSelectedItemName(item.name);
                              setShowItemDropdown(false);
                              setItemSearch("");
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-white/10 flex justify-between items-center transition-colors"
                          >
                            <span className="text-sm text-white">{item.name}</span>
                            <span className="text-xs text-gray-400">{formatCurrency(item.base_price || item.price || 0)}</span>
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

              {/* Multiple items picker */}
              {itemSelectionType === "multiple" && (
                <div>
                  <div className="relative mb-2">
                    <input
                      type="text"
                      placeholder="Search items to add..."
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      onFocus={() => setShowItemDropdown(true)}
                      onBlur={() => setTimeout(() => setShowItemDropdown(false), 200)}
                      className="w-full bg-[#2d2d2d] text-white px-4 py-3 rounded-xl border border-gray-600 focus:outline-none focus:border-penkey-orange transition-colors"
                    />
                    {showItemDropdown && filteredItems.length > 0 && (
                      <div className="absolute z-20 w-full bg-[#4d4d4d] border border-gray-600 rounded-xl mt-1.5 shadow-2xl max-h-48 overflow-y-auto">
                        {filteredItems.slice(0, 20).map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              hapticButtonPress();
                              if (!selectedItemIds.includes(item.id)) {
                                setSelectedItemIds([...selectedItemIds, item.id]);
                              }
                              setItemSearch("");
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-white/10 flex justify-between items-center transition-colors"
                          >
                            <span className="text-sm text-white">{item.name}</span>
                            <span className="text-xs text-penkey-orange">+ Add</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedItemIds.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedItemIds.map((id) => {
                        const item = items.find((it: any) => it.id === id);
                        if (!item) return null;
                        return (
                          <button
                            key={id}
                            onClick={() => {
                              hapticButtonPress();
                              setSelectedItemIds(selectedItemIds.filter((x) => x !== id));
                            }}
                            className="flex items-center gap-1.5 bg-penkey-orange/15 border border-penkey-orange/30 rounded-lg px-3 py-1.5 text-sm text-white"
                          >
                            {item.name}
                            <X className="h-3 w-3 text-penkey-orange" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {selectedItemIds.length === 0 && (
                    <p className="text-xs text-gray-500">Search and tap items to add them. Recipient can choose any one.</p>
                  )}
                </div>
              )}

              {/* Category picker (multi-select) */}
              {itemSelectionType === "category" && (
                <div className="space-y-2">
                  {categories.length === 0 && (
                    <p className="text-xs text-gray-500">No categories found.</p>
                  )}
                  {categories.map((cat) => {
                    const isSelected = selectedCategoryIds.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          hapticButtonPress();
                          if (isSelected) {
                            const newIds = selectedCategoryIds.filter((id) => id !== cat.id);
                            setSelectedCategoryIds(newIds);
                            setSelectedCategoryName(
                              newIds.map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean).join(", ")
                            );
                          } else {
                            const newIds = [...selectedCategoryIds, cat.id];
                            setSelectedCategoryIds(newIds);
                            setSelectedCategoryName(
                              newIds.map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean).join(", ")
                            );
                          }
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 flex items-center justify-between transition-colors ${
                          isSelected
                            ? "border-penkey-orange bg-penkey-orange/15"
                            : "border-gray-600/50 bg-[#2d2d2d] hover:border-gray-500"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cat.color || "#888" }}
                          />
                          <span className="text-sm font-medium text-white">{cat.name}</span>
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-penkey-orange" />
                        )}
                      </button>
                    );
                  })}
                  {selectedCategoryIds.length > 0 && (
                    <p className="text-xs text-gray-500">
                      Recipient can choose any active item from{" "}
                      <span className="text-white font-medium">{selectedCategoryName}</span>.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Voucher Title for item type */}
          {voucherType === "item" && (
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-penkey-orange" />
                Voucher Title
                <span className="text-gray-500 font-normal">(shows on the voucher)</span>
              </label>
              <input
                type="text"
                value={voucherTitle}
                onChange={(e) => setVoucherTitle(e.target.value)}
                placeholder="e.g. Choose Any Free Coffee"
                className="w-full bg-[#2d2d2d] text-white px-4 py-3 rounded-xl border border-gray-600 focus:outline-none focus:border-penkey-orange transition-colors"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                This text appears on the voucher. The selected items control what it can be redeemed against.
              </p>
            </div>
          )}

          {/* Live preview - real SVG matching the actual voucher */}
          <div className="bg-[#2d2d2d]/50 rounded-xl p-3 border border-gray-700/30">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Preview</div>
              <button
                onClick={() => {
                  hapticButtonPress();
                  setShowLayoutEditor(true);
                }}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-gray-600/50 text-gray-400 hover:border-gray-500 transition-colors"
              >
                <SlidersHorizontal className="h-3 w-3" />
                Customize Layout
              </button>
            </div>
            <div className="relative mx-auto bg-[#1a2847] rounded-xl overflow-hidden" style={{ maxWidth: 240 }}>
              <VoucherSvgPreview
                data={svgPreviewData}
                layout={voucherLayout}
                backgroundImageUrl={templates.find((t) => t.id === activeTemplateId)?.imageUrl || '/voucher.png'}
                className="w-full"
              />
            </div>
          </div>

          {/* Recipient */}
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
                className="w-full bg-[#2d2d2d] text-white px-4 py-3 rounded-xl border border-gray-600 focus:outline-none focus:border-penkey-orange transition-colors"
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
                className="w-full bg-[#2d2d2d] text-white px-4 py-3 rounded-xl border border-gray-600 focus:outline-none focus:border-penkey-orange transition-colors"
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
                    hapticButtonPress();
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
                className="w-full bg-[#2d2d2d] text-white px-4 py-3 rounded-xl border border-gray-600 focus:outline-none focus:border-penkey-orange transition-colors"
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
              className="w-full bg-[#2d2d2d] text-white px-4 py-3 rounded-xl border border-gray-600 focus:outline-none focus:border-penkey-orange resize-none transition-colors"
            />
          </div>

          {/* Batch / Campaign section - only for item & percent (amount goes through payment) */}
          {voucherType !== "amount" && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-penkey-orange" />
                  Quantity
                  <span className="text-gray-500 font-normal">(1 = single, &gt;1 = batch campaign)</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { hapticButtonPress(); setQuantity(Math.max(1, quantity - 1)); }}
                    className="w-10 h-10 rounded-lg bg-[#2d2d2d] border border-gray-600 text-white flex items-center justify-center flex-shrink-0"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="flex-1 bg-[#2d2d2d] text-white text-center px-4 py-2.5 rounded-xl border border-gray-600 focus:outline-none focus:border-penkey-orange transition-colors"
                  />
                  <button
                    onClick={() => { hapticButtonPress(); setQuantity(Math.min(100, quantity + 1)); }}
                    className="w-10 h-10 rounded-lg bg-[#2d2d2d] border border-gray-600 text-white flex items-center justify-center flex-shrink-0"
                  >
                    +
                  </button>
                </div>
                <div className="flex gap-2 mt-2">
                  {[5, 10, 25, 50].map((n) => (
                    <button
                      key={n}
                      onClick={() => { hapticButtonPress(); setQuantity(n); }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        quantity === n
                          ? "border-penkey-orange bg-penkey-orange/15 text-penkey-orange"
                          : "border-gray-600/50 bg-[#2d2d2d] text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {quantity > 1 && (
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">
                    Batch Label <span className="text-gray-500 font-normal">(e.g. "Summer Promo")</span>
                  </label>
                  <input
                    type="text"
                    value={batchLabel}
                    onChange={(e) => setBatchLabel(e.target.value)}
                    placeholder="Optional campaign name"
                    className="w-full bg-[#2d2d2d] text-white px-4 py-3 rounded-xl border border-gray-600 focus:outline-none focus:border-penkey-orange transition-colors"
                  />
                  <p className="text-xs text-gray-500 mt-1.5">
                    Creates {quantity} vouchers, each with a unique QR code. Scan once to redeem.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Custom voucher code - for pre-printed vouchers (item & percent only) */}
          {voucherType !== "amount" && (
            <div className="space-y-2">
              <button
                onClick={() => {
                  hapticButtonPress();
                  setUseCustomCode(!useCustomCode);
                  if (useCustomCode) setCustomCode("");
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors ${
                  useCustomCode
                    ? "border-penkey-orange bg-penkey-orange/10"
                    : "border-gray-600/50 bg-[#2d2d2d]"
                }`}
              >
                <QrCode className="h-5 w-5 flex-shrink-0 text-penkey-orange" />
                <span className="flex-1 text-left text-sm font-medium text-white">
                  Use custom code (pre-printed voucher)
                </span>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    useCustomCode ? "bg-penkey-orange border-penkey-orange" : "border-gray-500"
                  }`}
                >
                  {useCustomCode && <Check className="h-3 w-3 text-white" />}
                </div>
              </button>
              {useCustomCode && (
                <div>
                  <input
                    type="text"
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value)}
                    placeholder="e.g. SUMMER-2024-001"
                    className="w-full bg-[#2d2d2d] text-white px-4 py-3 rounded-xl border border-gray-600 focus:outline-none focus:border-penkey-orange font-mono transition-colors"
                  />
                  <p className="text-xs text-gray-500 mt-1.5">
                    Enter the code printed on your pre-made voucher. The system will use this instead of generating a new one.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Send email toggle */}
          {recipientEmail && (
            <button
              onClick={() => {
                hapticButtonPress();
                setSendEmail(!sendEmail);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors ${
                sendEmail
                  ? "border-penkey-orange bg-penkey-orange/10"
                  : "border-gray-600/50 bg-[#2d2d2d]"
              }`}
            >
              <Mail className="h-5 w-5 flex-shrink-0 text-penkey-orange" />
              <span className="flex-1 text-left text-sm font-medium text-white">
                Send voucher by email to {recipientEmail}
              </span>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
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

        {/* Footer */}
        <div className="p-3 border-t border-gray-700 flex-shrink-0">
          <Button
            onClick={handleCreate}
            disabled={creating || !isFormValid()}
            className="w-full bg-penkey-orange hover:bg-penkey-orange/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold h-12 flex items-center justify-center gap-2"
          >
            {creating ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
                Creating...
              </>
            ) : (
              <>
                <Gift className="h-5 w-5" />
                {voucherType === "amount" && !isPromotional
                  ? "Continue to Payment"
                  : voucherType === "amount" && isPromotional
                  ? "Create Promotional Voucher"
                  : quantity > 1
                  ? `Create ${quantity} Vouchers`
                  : "Create Voucher"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Full-screen layout editor overlay */}
      {showLayoutEditor && (
        <VoucherTemplateEditor
          previewData={svgPreviewData}
          layout={voucherLayout}
          onLayoutChange={setVoucherLayout}
          onSave={handleSaveLayout}
          saving={savingLayout}
          onClose={() => setShowLayoutEditor(false)}
          templates={templates}
          activeTemplateId={activeTemplateId}
          backgroundImageUrl={templates.find((t) => t.id === activeTemplateId)?.imageUrl || '/voucher.png'}
          onSelectTemplate={handleSelectTemplate}
          onCreateTemplate={handleCreateTemplate}
          onDeleteTemplate={handleDeleteTemplate}
          onUploadTemplateImage={handleUploadTemplateImage}
        />
      )}
    </div>
  );
}
