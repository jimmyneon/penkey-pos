"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@penkey/ui";
import {
  ArrowLeft,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Package,
  Bell,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  pending: "New",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLOURS: Record<string, string> = {
  pending: "bg-yellow-500",
  accepted: "bg-blue-500",
  preparing: "bg-purple-500",
  ready: "bg-green-500",
  completed: "bg-gray-500",
  cancelled: "bg-red-500",
};

const ACTIVE_STATUSES = ["pending", "accepted", "preparing", "ready"];

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"active" | "all">("active");
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter === "active") params.set("status", ACTIVE_STATUSES.join(","));
      const res = await fetch(`/api/orders?${params}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchOrders();
        if (selectedOrder?.id === orderId) {
          setSelectedOrder((prev: any) => ({ ...prev, status: newStatus }));
        }
      }
    } catch (err) {
      console.error("Failed to update order:", err);
    } finally {
      setUpdating(false);
    }
  };

  const pendingCount = orders.filter((o) => o.status === "pending").length;

  const nextStatus: Record<string, string> = {
    pending: "accepted",
    accepted: "preparing",
    preparing: "ready",
    ready: "completed",
  };

  const nextStatusLabel: Record<string, string> = {
    pending: "Accept",
    accepted: "Start Preparing",
    preparing: "Mark Ready",
    ready: "Complete",
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col text-white">
      {/* Header */}
      <header className="bg-[#3d3d3d] px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/sell")} className="p-2 rounded-lg hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Orders</h1>
            {pendingCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={fetchOrders}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </header>

      {/* Filter tabs */}
      <div className="flex border-b border-gray-700 bg-[#3d3d3d]">
        {(["active", "all"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setFilter(tab); setLoading(true); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors capitalize ${
              filter === tab
                ? "border-b-2 border-penkey-orange text-penkey-orange"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab === "active" ? "Active Orders" : "All Orders"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <RefreshCw className="h-8 w-8 animate-spin text-penkey-orange" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-400">
            <Package className="h-16 w-16 opacity-30" />
            <p className="text-lg">No {filter === "active" ? "active " : ""}orders</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {orders.map((order) => (
              <button
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className="w-full text-left px-4 py-4 hover:bg-white/5 transition-colors flex items-center gap-4"
              >
                {/* Status dot */}
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${STATUS_COLOURS[order.status] || "bg-gray-500"}`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold">#{order.order_number}</span>
                    {order.customer_name && (
                      <span className="text-gray-400 text-sm truncate">{order.customer_name}</span>
                    )}
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full text-white ${STATUS_COLOURS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400 flex items-center gap-3">
                    <span>{(order.lines || []).length} item(s)</span>
                    <span>{formatCurrency(order.total)}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(order.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
          <div className="bg-[#3d3d3d] flex-1 flex flex-col overflow-hidden max-h-screen">
            {/* Modal header */}
            <div className="px-4 py-4 border-b border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Order #{selectedOrder.order_number}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full text-white ${STATUS_COLOURS[selectedOrder.status]}`}>
                    {STATUS_LABELS[selectedOrder.status]}
                  </span>
                  <span className="text-sm text-gray-400">
                    {new Date(selectedOrder.created_at).toLocaleString("en-GB")}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            {/* Order details */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedOrder.customer_name && (
                <div className="bg-[#2d2d2d] rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">CUSTOMER</div>
                  <div className="font-semibold">{selectedOrder.customer_name}</div>
                  {selectedOrder.customer_phone && (
                    <div className="text-sm text-gray-400">{selectedOrder.customer_phone}</div>
                  )}
                </div>
              )}

              {/* Line items */}
              <div className="bg-[#2d2d2d] rounded-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-700 text-xs text-gray-400 uppercase">Items</div>
                {(selectedOrder.lines || []).map((line: any, i: number) => (
                  <div key={i} className="px-3 py-3 flex justify-between border-b border-gray-700/50 last:border-0">
                    <div>
                      <span className="font-medium">{line.item_name || line.name}</span>
                      {line.notes && <div className="text-xs text-gray-400 mt-0.5">{line.notes}</div>}
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-gray-400">×{line.quantity}</div>
                      <div>{formatCurrency((line.unit_price || 0) * (line.quantity || 1))}</div>
                    </div>
                  </div>
                ))}
                <div className="px-3 py-3 flex justify-between font-bold border-t border-gray-600">
                  <span>Total</span>
                  <span>{formatCurrency(selectedOrder.total)}</span>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-3">
                  <div className="text-xs text-yellow-400 mb-1">NOTES</div>
                  <div className="text-sm">{selectedOrder.notes}</div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            {nextStatus[selectedOrder.status] && (
              <div className="p-4 border-t border-gray-700 flex gap-3">
                <button
                  onClick={() => handleStatusChange(selectedOrder.id, "cancelled")}
                  disabled={updating}
                  className="px-4 py-3 bg-red-600/20 border border-red-600/40 text-red-400 rounded-lg font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleStatusChange(selectedOrder.id, nextStatus[selectedOrder.status])}
                  disabled={updating}
                  className="flex-1 py-3 bg-penkey-orange hover:bg-penkey-orange/90 text-white rounded-lg font-bold text-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  {nextStatusLabel[selectedOrder.status]}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
