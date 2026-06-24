"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from "@penkey/ui";
import { Percent, PoundSterling, Loader2, Check, Store, Globe, UserCircle } from "lucide-react";
import { hapticButtonPress } from "@/lib/utils/haptics";
import { useScrollLock } from "@/hooks/use-scroll-lock";

interface DiscountCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingDiscount?: any | null;
}

export function DiscountCreateModal({ open, onClose, onSaved, editingDiscount }: DiscountCreateModalProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [maxDiscountAmount, setMaxDiscountAmount] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [onePerCustomer, setOnePerCustomer] = useState(false);
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [channels, setChannels] = useState<string[]>(['pos']);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useScrollLock(open);

  useEffect(() => {
    if (open) {
      if (editingDiscount) {
        setCode(editingDiscount.code || "");
        setName(editingDiscount.name || "");
        setDescription(editingDiscount.description || "");
        setDiscountType(editingDiscount.type || editingDiscount.discount_type || 'percentage');
        setDiscountValue((editingDiscount.value ?? editingDiscount.discount_value)?.toString() || "");
        setMinOrderAmount(editingDiscount.min_order_amount?.toString() || "");
        setMaxDiscountAmount(editingDiscount.max_discount_amount?.toString() || "");
        setUsageLimit(editingDiscount.usage_limit?.toString() || "");
        setOnePerCustomer(editingDiscount.one_per_customer || false);
        setValidFrom(editingDiscount.valid_from ? editingDiscount.valid_from.split('T')[0] : "");
        setValidUntil(editingDiscount.valid_until ? editingDiscount.valid_until.split('T')[0] : "");
        setChannels(editingDiscount.allowed_channels || ['pos']);
        setIsActive(editingDiscount.is_active !== false);
      } else {
        setCode("");
        setName("");
        setDescription("");
        setDiscountType('percentage');
        setDiscountValue("");
        setMinOrderAmount("");
        setMaxDiscountAmount("");
        setUsageLimit("");
        setOnePerCustomer(false);
        setValidFrom("");
        setValidUntil("");
        setChannels(['pos']);
        setIsActive(true);
      }
      setError(null);
    }
  }, [open, editingDiscount]);

  const toggleChannel = (ch: string) => {
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);
  };

  const handleSave = async () => {
    if (!code.trim() || !name.trim()) {
      setError("Code and name are required");
      return;
    }
    if (!discountValue || parseFloat(discountValue) <= 0) {
      setError("Discount value must be greater than 0");
      return;
    }
    if (channels.length === 0) {
      setError("Select at least one channel");
      return;
    }

    hapticButtonPress();
    setSaving(true);
    setError(null);

    try {
      const body: any = {
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        discount_type: discountType,
        discount_value: parseFloat(discountValue),
        min_order_amount: minOrderAmount ? parseFloat(minOrderAmount) : 0,
        max_discount_amount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null,
        usage_limit: usageLimit ? parseInt(usageLimit) : null,
        one_per_customer: onePerCustomer,
        valid_from: validFrom || null,
        valid_until: validUntil || null,
        allowed_channels: channels,
        is_active: isActive,
      };

      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      const url = editingDiscount
        ? `/api/discounts/${editingDiscount.id}`
        : "/api/discounts";
      const method = editingDiscount ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(sessionData ? { "x-pos-session": sessionData } : {}),
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onSaved();
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save discount");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-[#3d3d3d] text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">
            {editingDiscount ? "Edit Discount" : "Create Discount"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Code + Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Code *</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="SUMMER10"
                className="w-full bg-[#2d2d2d] border border-gray-600 rounded-lg px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-penkey-orange"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Summer 10% Off"
                className="w-full bg-[#2d2d2d] border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-penkey-orange"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full bg-[#2d2d2d] border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-penkey-orange"
            />
          </div>

          {/* Discount Type */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Discount Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { hapticButtonPress(); setDiscountType('percentage'); }}
                className={`flex items-center justify-center gap-2 rounded-lg py-3 transition-all ${
                  discountType === 'percentage'
                    ? 'bg-penkey-orange text-white ring-2 ring-penkey-orange/50'
                    : 'bg-[#4d4d4d] hover:bg-[#5d5d5d] text-gray-300'
                }`}
              >
                <Percent className="h-5 w-5" />
                <span className="font-semibold">Percentage</span>
              </button>
              <button
                onClick={() => { hapticButtonPress(); setDiscountType('fixed'); }}
                className={`flex items-center justify-center gap-2 rounded-lg py-3 transition-all ${
                  discountType === 'fixed'
                    ? 'bg-penkey-orange text-white ring-2 ring-penkey-orange/50'
                    : 'bg-[#4d4d4d] hover:bg-[#5d5d5d] text-gray-300'
                }`}
              >
                <PoundSterling className="h-5 w-5" />
                <span className="font-semibold">Fixed Amount</span>
              </button>
            </div>
          </div>

          {/* Discount Value */}
          <div>
            <label className="text-sm text-gray-400 mb-1 block">
              {discountType === 'percentage' ? 'Percentage Off (%) *' : 'Amount Off (£) *'}
            </label>
            <input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === 'percentage' ? "10" : "5.00"}
              step={discountType === 'percentage' ? "1" : "0.01"}
              min="0"
              max={discountType === 'percentage' ? "100" : undefined}
              className="w-full bg-[#2d2d2d] border border-gray-600 rounded-lg px-3 py-2 text-white text-lg focus:outline-none focus:border-penkey-orange"
            />
          </div>

          {/* Constraints */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Min Order (£)</label>
              <input
                type="number"
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(e.target.value)}
                placeholder="0"
                step="0.01"
                className="w-full bg-[#2d2d2d] border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-penkey-orange"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Max Discount (£)</label>
              <input
                type="number"
                value={maxDiscountAmount}
                onChange={(e) => setMaxDiscountAmount(e.target.value)}
                placeholder="No limit"
                step="0.01"
                className="w-full bg-[#2d2d2d] border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-penkey-orange"
              />
            </div>
          </div>

          {/* Usage Limit + One Per Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Usage Limit</label>
              <input
                type="number"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                placeholder="No limit"
                min="1"
                className="w-full bg-[#2d2d2d] border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-penkey-orange"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => { hapticButtonPress(); setOnePerCustomer(!onePerCustomer); }}
                className={`w-full rounded-lg py-2 px-3 text-sm font-semibold transition-colors ${
                  onePerCustomer ? 'bg-penkey-orange text-white' : 'bg-[#4d4d4d] text-gray-300 hover:bg-[#5d5d5d]'
                }`}
              >
                {onePerCustomer ? '✓ One per customer' : 'One per customer'}
              </button>
            </div>
          </div>

          {/* Validity Period */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Valid From</label>
              <input
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="w-full bg-[#2d2d2d] border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-penkey-orange"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Valid Until</label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full bg-[#2d2d2d] border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-penkey-orange"
              />
            </div>
          </div>

          {/* Channel Restrictions */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Allowed Channels</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'pos', label: 'POS', icon: Store },
                { key: 'online', label: 'Online', icon: Globe },
                { key: 'staff', label: 'Staff', icon: UserCircle },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => { hapticButtonPress(); toggleChannel(key); }}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    channels.includes(key)
                      ? 'bg-penkey-orange text-white'
                      : 'bg-[#4d4d4d] text-gray-300 hover:bg-[#5d5d5d]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Active Toggle */}
          <div>
            <button
              onClick={() => { hapticButtonPress(); setIsActive(!isActive); }}
              className={`w-full rounded-lg py-2 px-3 text-sm font-semibold transition-colors ${
                isActive ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
              }`}
            >
              {isActive ? '✓ Active' : 'Inactive'}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 rounded-lg p-3">{error}</div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              size="lg"
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white h-12"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              className="flex-1 bg-penkey-orange hover:bg-penkey-orange/90 text-white h-12"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Check className="h-5 w-5 mr-2" /> {editingDiscount ? "Update" : "Create"}</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
