"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { formatCurrency } from "@penkey/ui";
import {
  ArrowLeft, Percent, Plus, Loader2, Edit3, Trash2, Store, Globe, UserCircle,
  Calendar, Ticket,
} from "lucide-react";
import { hapticButtonPress } from "@/lib/utils/haptics";
import { DiscountCreateModal } from "./discount-create-modal";

interface Session {
  employee: { id: string; name: string; role: string };
  register: { id: string; name: string; store_name: string };
  org_id: string;
}

export default function DiscountsPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [fetching, setFetching] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<any | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const sessionData = sessionStorage.getItem("pos_session");
    if (!sessionData) {
      router.push("/lock");
      return;
    }
    try {
      setSession(JSON.parse(sessionData));
    } catch {
      router.push("/lock");
      return;
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchDiscounts = useCallback(async () => {
    setFetching(true);
    try {
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      const res = await fetch("/api/discounts", {
        headers: sessionData ? { "x-pos-session": sessionData } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setDiscounts(data.discounts || []);
      }
    } catch {
      // ignore
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (session) fetchDiscounts();
  }, [session, fetchDiscounts]);

  const handleEdit = (discount: any) => {
    hapticButtonPress();
    setEditingDiscount(discount);
    setModalOpen(true);
  };

  const handleCreate = () => {
    hapticButtonPress();
    setEditingDiscount(null);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    hapticButtonPress();
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(null), 3000);
      return;
    }
    try {
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      const res = await fetch(`/api/discounts/${id}`, {
        method: "DELETE",
        headers: sessionData ? { "x-pos-session": sessionData } : {},
      });
      if (res.ok) {
        fetchDiscounts();
      }
    } catch {
      // ignore
    }
    setDeleteConfirmId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#2d2d2d] flex flex-col overflow-hidden">
      <header className="bg-[#3d3d3d] text-white px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { hapticButtonPress(); router.back(); }}
          className="text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </Button>
        <h1 className="font-semibold text-lg">Discounts</h1>
        <Button
          size="sm"
          onClick={handleCreate}
          className="bg-penkey-orange hover:bg-penkey-orange/90 text-white"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Discount
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {fetching ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 text-penkey-orange animate-spin" />
          </div>
        ) : discounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Percent className="h-16 w-16 text-gray-600 mb-4" />
            <p className="text-gray-400 mb-2">No discounts yet</p>
            <p className="text-gray-500 text-sm mb-4">Create discount codes for POS, online, or staff use</p>
            <Button
              onClick={handleCreate}
              className="bg-penkey-orange hover:bg-penkey-orange/90 text-white"
            >
              <Plus className="h-4 w-4 mr-1" />
              Create First Discount
            </Button>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-3">
            {discounts.map((discount) => {
              const isExpired = discount.valid_until && new Date(discount.valid_until) < new Date();
              const isUsedUp = discount.usage_limit && discount.usage_count >= discount.usage_limit;
              const channels: string[] = discount.allowed_channels || ['pos'];

              return (
                <div
                  key={discount.id}
                  className={`bg-[#3d3d3d] rounded-lg p-4 border ${
                    discount.is_active && !isExpired && !isUsedUp
                      ? 'border-gray-700'
                      : 'border-gray-800 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-lg">{discount.name}</span>
                        {!discount.is_active && (
                          <span className="text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded">Inactive</span>
                        )}
                        {isExpired && (
                          <span className="text-xs bg-red-900/40 text-red-400 px-2 py-0.5 rounded">Expired</span>
                        )}
                        {isUsedUp && (
                          <span className="text-xs bg-red-900/40 text-red-400 px-2 py-0.5 rounded">Used Up</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm text-penkey-orange font-mono bg-[#2d2d2d] px-2 py-0.5 rounded">
                          {discount.code}
                        </code>
                        <span className="text-lg font-bold text-white">
                          {discount.discount_type === 'percentage'
                            ? `${parseFloat(discount.discount_value)}%`
                            : formatCurrency(parseFloat(discount.discount_value))}
                        </span>
                      </div>
                      {discount.description && (
                        <p className="text-sm text-gray-400 mt-1">{discount.description}</p>
                      )}

                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                        {channels.map((ch) => {
                          const icon = ch === 'pos' ? Store : ch === 'online' ? Globe : UserCircle;
                          const Icon = icon;
                          return (
                            <span key={ch} className="flex items-center gap-1 capitalize">
                              <Icon className="h-3 w-3" />
                              {ch}
                            </span>
                          );
                        })}
                        {discount.usage_limit && (
                          <span className="flex items-center gap-1">
                            <Ticket className="h-3 w-3" />
                            {discount.usage_count}/{discount.usage_limit} used
                          </span>
                        )}
                        {discount.valid_until && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Until {new Date(discount.valid_until).toLocaleDateString('en-GB')}
                          </span>
                        )}
                        {discount.min_order_amount > 0 && (
                          <span>Min: {formatCurrency(parseFloat(discount.min_order_amount))}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-3">
                      <button
                        onClick={() => handleEdit(discount)}
                        className="bg-[#4d4d4d] hover:bg-[#5d5d5d] text-white rounded-lg p-2 transition-colors"
                        title="Edit"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(discount.id)}
                        className={`rounded-lg p-2 transition-colors ${
                          deleteConfirmId === discount.id
                            ? 'bg-red-600 text-white'
                            : 'bg-[#4d4d4d] hover:bg-[#5d5d5d] text-white'
                        }`}
                        title={deleteConfirmId === discount.id ? 'Click again to confirm' : 'Delete'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DiscountCreateModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingDiscount(null); }}
        onSaved={fetchDiscounts}
        editingDiscount={editingDiscount}
      />
    </div>
  );
}
