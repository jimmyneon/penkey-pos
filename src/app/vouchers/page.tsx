"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { ArrowLeft, Gift, Plus, Search, Loader2 } from "lucide-react";
import { useCartStore } from "@/lib/store/cart-store";
import { hapticButtonPress } from "@/lib/utils/haptics";
import { useToast } from "@/lib/hooks/use-toast";
import { ToastContainer } from "@/components/toast-container";
import { VoucherCreateModal } from "./voucher-create-modal";
import { VoucherDetailModal } from "./voucher-detail-modal";
import { VoucherCard } from "./voucher-card";

interface Session {
  employee: { id: string; name: string; role: string };
  register: { id: string; name: string; store_name: string };
  org_id: string;
}

export default function VouchersPage() {
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();
  const { lines } = useCartStore();
  const [session, setSession] = useState<Session | null>(null);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    const sessionData = sessionStorage.getItem("pos_session");
    if (!sessionData) {
      router.push("/lock");
      return;
    }
    try {
      const parsed = JSON.parse(sessionData);
      setSession(parsed);
      fetchVouchers(parsed.org_id);
      fetchItems(parsed.org_id);
    } catch (err) {
      router.push("/lock");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchVouchers = async (orgId?: string) => {
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

  const fetchItems = async (orgId?: string) => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-penkey-orange animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#2d2d2d] flex flex-col overflow-hidden relative">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header - matches other pages */}
      <header className="bg-[#3d3d3d] text-white px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            hapticButtonPress();
            router.back();
          }}
          className="text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </Button>
        <h1 className="font-semibold text-lg">Gift Vouchers</h1>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            hapticButtonPress();
            setSearchOpen(!searchOpen);
            if (!searchOpen) setSearch("");
          }}
          className="text-white hover:bg-white/10"
        >
          <Search className="h-5 w-5" />
        </Button>
      </header>

      {/* Search Bar - matches categories page pattern */}
      {searchOpen && (
        <div className="bg-[#3d3d3d] border-b border-gray-700 px-4 py-3">
          <input
            type="text"
            placeholder="Search by code, name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#2d2d2d] text-white px-4 py-2.5 rounded-lg border border-gray-600 focus:outline-none focus:border-penkey-orange text-sm"
            autoFocus
          />
        </div>
      )}

      {/* Summary bar */}
      {!loading && filtered.length > 0 && (
        <div className="bg-[#3d3d3d]/50 px-4 py-2 border-b border-gray-700/50">
          <p className="text-xs text-gray-400">
            {filtered.length} voucher{filtered.length !== 1 ? "s" : ""}
            {activeCount > 0 && <span className="text-green-400"> · {activeCount} active</span>}
          </p>
        </div>
      )}

      {/* Voucher list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
            <div className="bg-penkey-orange/10 rounded-full p-6">
              <Gift className="h-12 w-12 text-penkey-orange/50" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium">No vouchers yet</p>
              <p className="text-sm text-gray-500 mt-1">Create your first gift voucher</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-700/50">
            {filtered.map((voucher) => (
              <VoucherCard
                key={voucher.id}
                voucher={voucher}
                onClick={() => {
                  hapticButtonPress();
                  setSelectedVoucher(voucher);
                  setShowDetail(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Create Button - matches mobile-first design */}
      <div className="p-4 border-t border-gray-700 bg-[#3d3d3d]">
        <Button
          onClick={() => {
            hapticButtonPress();
            setShowCreate(true);
          }}
          className="w-full bg-penkey-orange hover:bg-penkey-orange/90 text-white font-semibold flex items-center justify-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Create Voucher
        </Button>
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
            showToast("Voucher deleted", "success");
          }}
          onEmailed={() => showToast("Voucher email sent", "success")}
          onRedeemed={() => showToast("Voucher applied to cart", "success")}
        />
      )}

      {/* Create Modal */}
      {showCreate && (
        <VoucherCreateModal
          items={items}
          onClose={() => setShowCreate(false)}
          onCreated={(voucher) => {
            setVouchers((prev) => [voucher, ...prev]);
            showToast("Voucher created", "success");
          }}
        />
      )}
    </div>
  );
}
