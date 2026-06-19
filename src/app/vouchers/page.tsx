"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Gift, Plus, Search } from "lucide-react";
import { useCartStore } from "@/lib/store/cart-store";
import { VoucherCreateModal } from "./voucher-create-modal";
import { VoucherDetailModal } from "./voucher-detail-modal";
import { VoucherCard } from "./voucher-card";

export default function VouchersPage() {
  const router = useRouter();
  const { lines } = useCartStore();
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    try {
      const session = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      if (!session) {
        router.push("/login");
        return;
      }
      fetchVouchers();
      fetchItems();
    } catch (err) {
      router.push("/login");
    }
  }, [router]);

  const fetchVouchers = async () => {
    try {
      const sessionData =
        sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch("/api/vouchers", {
        headers: sessionData ? { "x-pos-session": sessionData } : {},
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        setVouchers(data.vouchers || []);
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.error("[Vouchers] Fetch aborted due to timeout");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      const sessionData =
        sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch("/api/items?limit=200", {
        headers: sessionData ? { "x-pos-session": sessionData } : {},
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.error("[Vouchers] Items fetch aborted due to timeout");
      }
    }
  };

  const filtered = Array.isArray(vouchers)
    ? vouchers.filter((v) => {
        try {
          const fields = [v.code, v.recipient_name, v.recipient_email, v.item_name]
            .filter(Boolean)
            .map((f) => String(f).toLowerCase());
          return fields.some((f) => f.includes(search.toLowerCase()));
        } catch {
          return false;
        }
      })
    : [];

  const activeCount = filtered.filter((v) => v.status === "active").length;

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col text-white">
      {/* Header */}
      <header className="bg-[#3d3d3d] px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/sell")}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Gift Vouchers</h1>
            {!loading && (
              <p className="text-xs text-gray-400">
                {filtered.length} total{activeCount > 0 && ` · ${activeCount} active`}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-penkey-orange hover:bg-penkey-orange/90 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create
        </button>
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
            className="w-full bg-[#3d3d3d] text-white pl-10 pr-4 py-2.5 rounded-lg border border-gray-600 focus:outline-none focus:border-penkey-orange text-sm transition-colors"
          />
        </div>
      </div>

      {/* Voucher list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <VoucherListSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-400 animate-in fade-in duration-300">
            <div className="bg-penkey-orange/10 rounded-full p-6">
              <Gift className="h-12 w-12 text-penkey-orange/50" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium">No vouchers yet</p>
              <p className="text-sm text-gray-500 mt-1">Create your first gift voucher</p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-penkey-orange text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-penkey-orange/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Voucher
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-700/50">
            {filtered.map((voucher, index) => (
              <div
                key={voucher.id}
                className="animate-in fade-in slide-in-from-bottom-2 duration-200"
                style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
              >
                <VoucherCard
                  voucher={voucher}
                  onClick={() => {
                    setSelectedVoucher(voucher);
                    setShowDetail(true);
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetail && selectedVoucher && (
        <VoucherDetailModal
          voucher={selectedVoucher}
          lines={lines}
          onClose={() => {
            setShowDetail(false);
            setSelectedVoucher(null);
          }}
          onDeleted={(id) => {
            setVouchers((prev) => prev.filter((v) => v.id !== id));
            setShowDetail(false);
            setSelectedVoucher(null);
          }}
        />
      )}

      {/* Create Modal */}
      {showCreate && (
        <VoucherCreateModal
          items={items}
          onClose={() => setShowCreate(false)}
          onCreated={(voucher) => {
            setVouchers((prev) => [voucher, ...prev]);
          }}
        />
      )}
    </div>
  );
}

function VoucherListSkeleton() {
  return (
    <div className="divide-y divide-gray-700/50">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="px-4 py-4 flex items-center gap-3 animate-pulse">
          <div className="bg-gray-700/30 rounded-xl p-2.5 w-12 h-12 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-700/30 rounded w-32" />
            <div className="h-3 bg-gray-700/20 rounded w-24" />
            <div className="h-3 bg-gray-700/20 rounded w-40" />
          </div>
        </div>
      ))}
    </div>
  );
}
