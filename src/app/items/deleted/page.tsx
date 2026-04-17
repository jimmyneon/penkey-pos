"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@penkey/ui";
import { ArrowLeft, Package, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { formatCurrency } from "@penkey/ui";
import { hapticButtonPress } from "@/lib/utils/haptics";
import { PageHeader } from "@/components/page-header";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/lib/hooks/use-toast";
import { dataCache } from "@/lib/services/data-cache";
import { SyncManager } from "@/lib/services/sync-manager";
import { clearStore } from "@/lib/idb/db";

interface Session {
  employee: { id: string; name: string; role: string };
  register: { id: string; name: string; store_name: string };
  org_id: string;
}

interface DeletedItem {
  id: string;
  name: string;
  category_id: string | null;
  base_price: number | null;
  image_url: string | null;
  sku: string | null;
  categories: {
    name: string;
    color: string;
  } | null;
  updated_at: string;
}

export default function DeletedItemsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [permanentDeleting, setPermanentDeleting] = useState<string | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [restoreItem, setRestoreItem] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const sessionData = sessionStorage.getItem("pos_session");
    if (!sessionData) {
      router.replace("/lock");
      return;
    }
    try {
      const parsed = JSON.parse(sessionData);
      setSession(parsed);
    } catch (err) {
      console.error("Failed to parse session:", err);
      router.replace("/lock");
    }
  }, [router]);

  useEffect(() => {
    if (session) {
      loadDeletedItems();
    }
  }, [session]);

  const loadDeletedItems = async () => {
    try {
      setLoading(true);
      console.log("[DeletedItems] Fetching deleted items...");
      
      const response = await fetch("/api/items/deleted", {
        credentials: "same-origin",
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch deleted items");
      }
      
      const data = await response.json();
      console.log("[DeletedItems] Loaded", data.length, "deleted items");
      setItems(data);
    } catch (error: any) {
      console.error("Failed to load deleted items:", error);
      showToast("Failed to load deleted items", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (itemId: string, itemName: string) => {
    if (!session) return;

    setRestoreItem({ id: itemId, name: itemName });
    setRestoreConfirmOpen(true);
  };

  const confirmRestore = async () => {
    if (!session || !restoreItem) return;

    try {
      setRestoring(restoreItem.id);
      console.log("[DeletedItems] Restoring item:", restoreItem.id);

      const response = await fetch(`/api/items/${restoreItem.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ is_active: true }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to restore item");
      }

      // Clear caches to force refresh
      dataCache.clear(session.org_id, "items");
      SyncManager.clearSyncTimestamp(session.org_id, "ITEMS");
      await clearStore("items");

      showToast(`${restoreItem.name} restored successfully`, "success");

      // Reload the deleted items list
      loadDeletedItems();
    } catch (error: any) {
      console.error("Failed to restore item:", error);
      showToast(`Failed to restore item: ${error.message}`, "error");
    } finally {
      setRestoring(null);
      setRestoreConfirmOpen(false);
      setRestoreItem(null);
    }
  };

  const handlePermanentDelete = async (itemId: string, itemName: string) => {
    if (!session) return;

    setDeleteItem({ id: itemId, name: itemName });
    setDeleteConfirmOpen(true);
  };

  const confirmPermanentDelete = async () => {
    if (!session || !deleteItem) return;

    try {
      setPermanentDeleting(deleteItem.id);
      console.log("[DeletedItems] Permanently deleting item:", deleteItem.id);

      const response = await fetch(`/api/items/${deleteItem.id}/permanent`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete item");
      }

      showToast(`${deleteItem.name} permanently deleted`, "success");

      // Reload the deleted items list
      loadDeletedItems();
    } catch (error: any) {
      console.error("Failed to permanently delete item:", error);
      showToast(`Failed to delete item: ${error.message}`, "error");
    } finally {
      setPermanentDeleting(null);
      setDeleteConfirmOpen(false);
      setDeleteItem(null);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-penkey-orange animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#2d2d2d] flex flex-col overflow-hidden">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#3d3d3d] rounded-lg p-6 shadow-xl flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-penkey-orange animate-spin" />
            <p className="text-sm font-medium text-white">Loading deleted items...</p>
          </div>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title="Deleted Items"
        showBack={true}
        showHome={true}
        showMenu={false}
        backHref="/items-hub"
        session={session}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {items.length > 0 ? (
          <div className="divide-y divide-gray-700">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-[#3d3d3d] p-4 flex items-center gap-3"
              >
                <div className="w-14 h-14 rounded-lg bg-[#2d2d2d] flex items-center justify-center flex-shrink-0">
                  {item.image_url ? (
                    <img
                      src={item.image_url.replace('/full.webp', '/thumbnail.webp')}
                      alt={item.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <Package className="h-6 w-6 text-gray-600" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-white text-sm truncate">{item.name}</h3>
                    <Badge variant="outline" className="text-xs text-red-400 border-red-600">
                      Deleted
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {item.categories && (
                      <span>{item.categories.name}</span>
                    )}
                    {item.base_price !== null && (
                      <span>• {formatCurrency(item.base_price)}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Deleted: {new Date(item.updated_at).toLocaleDateString()}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      hapticButtonPress();
                      handleRestore(item.id, item.name);
                    }}
                    disabled={restoring === item.id || permanentDeleting === item.id}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {restoring === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      hapticButtonPress();
                      handlePermanentDelete(item.id, item.name);
                    }}
                    disabled={restoring === item.id || permanentDeleting === item.id}
                    className="text-red-400 hover:bg-red-600/10"
                  >
                    {permanentDeleting === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 px-4">
            <Trash2 className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No deleted items</p>
            <p className="text-gray-500 text-sm mt-2">
              Deleted items will appear here and can be restored
            </p>
          </div>
        )}
      </div>

      {/* Restore Confirmation Dialog */}
      <ConfirmDialog
        open={restoreConfirmOpen}
        onClose={() => {
          setRestoreConfirmOpen(false);
          setRestoreItem(null);
        }}
        onConfirm={confirmRestore}
        title="Restore Item"
        message={`Are you sure you want to restore "${restoreItem?.name}"? This will make it available for sale again.`}
        confirmText="Restore"
        cancelText="Cancel"
      />

      {/* Permanent Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDeleteItem(null);
        }}
        onConfirm={confirmPermanentDelete}
        title="Permanently Delete Item"
        message={`Are you sure you want to permanently delete "${deleteItem?.name}"? This CANNOT be undone and will remove all historical data.`}
        confirmText="Permanently Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
