"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@penkey/ui";
import { X, Settings, Package, BarChart3, Lock, Receipt, ShoppingCart, RefreshCw, Clock } from "lucide-react";
import { SyncManager } from "@/lib/services/sync-manager";

interface SidebarMenuProps {
  open: boolean;
  onClose: () => void;
  onLock: () => void;
  onSync?: () => void;
  syncing?: boolean;
  lastSync?: number | null;
  storeName: string;
  registerName: string;
}

export function SidebarMenu({ open, onClose, onLock, onSync, syncing, lastSync, storeName, registerName }: SidebarMenuProps) {
  const router = useRouter();
  const [computedLastSync, setComputedLastSync] = useState<number | null>(null);

  // Poll SyncManager for the most recent last sync while the menu is open,
  // to keep it consistent with the header dot indicator.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const refreshLastSync = async () => {
      try {
        const sessionRaw = sessionStorage.getItem("pos_session");
        if (!sessionRaw) return;
        const session = JSON.parse(sessionRaw);
        if (!session?.org_id) return;

        const status = await SyncManager.getSyncStatus(session.org_id);
        let mostRecent = 0;
        for (const key in status) {
          const ts = status[key as keyof typeof status].lastSync;
          if (ts && ts > mostRecent) mostRecent = ts;
        }
        if (!cancelled) setComputedLastSync(mostRecent || null);
      } catch (e) {
        // no-op
      }
    };

    refreshLastSync();
    const id = setInterval(refreshLastSync, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      return () => {
        document.body.style.overflow = '';
        document.body.style.pointerEvents = '';
      };
    } else {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
    }
  }, [open]);
  
  const formatLastSync = (timestamp: number | null | undefined) => {
    if (!timestamp) return "Never";
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[85vw] max-w-[320px] sm:w-80 bg-[#3d3d3d] text-white p-0 h-screen fixed left-0 top-0 !translate-x-0 !translate-y-0 rounded-none border-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left duration-300">
        <DialogTitle className="sr-only">Menu</DialogTitle>
        <DialogDescription className="sr-only">Navigation menu for POS system</DialogDescription>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-700">
            <h2 className="font-bold text-lg">{storeName}</h2>
            <p className="text-sm text-gray-400">{registerName}</p>
          </div>

          {/* Menu Items */}
          <div className="flex-1 p-4">
            <nav className="space-y-2">
              <button 
                onClick={() => {
                  onClose();
                  router.push('/sell');
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors text-left"
              >
                <ShoppingCart className="h-5 w-5" />
                <span>POS</span>
              </button>
              <button 
                onClick={() => {
                  onClose();
                  router.push('/receipts');
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors text-left"
              >
                <Receipt className="h-5 w-5" />
                <span>Receipts</span>
              </button>
              <button 
                onClick={() => {
                  onClose();
                  router.push('/items-hub');
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors text-left"
              >
                <Package className="h-5 w-5" />
                <span>Items</span>
              </button>
              <button 
                onClick={() => {
                  onClose();
                  router.push('/reports');
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors text-left"
              >
                <BarChart3 className="h-5 w-5" />
                <span>Reports</span>
              </button>
              <button 
                onClick={() => {
                  onClose();
                  router.push('/shifts');
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors text-left"
              >
                <Clock className="h-5 w-5" />
                <span>Shifts</span>
              </button>
              <button 
                onClick={() => {
                  onClose();
                  router.push('/settings');
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors text-left"
              >
                <Settings className="h-5 w-5" />
                <span>Settings</span>
              </button>
            </nav>

            {/* Sync Data Section */}
            {onSync && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <button
                  onClick={() => {
                    onSync();
                  }}
                  disabled={syncing}
                  className="w-full h-12 flex items-center gap-3 px-4 rounded-lg bg-penkey-orange hover:bg-penkey-orange/90 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
                  <span className="font-semibold">Sync Data</span>
                </button>

                {/* Lock POS - placed under Sync with extra spacing, same thickness/layout */}
                <button
                  onClick={() => {
                    onClose();
                    onLock();
                  }}
                  className="mt-[160px] w-full h-12 flex items-center gap-3 px-4 rounded-lg bg-red-600 hover:bg-red-700 transition-colors text-left"
                >
                  <Lock className="h-5 w-5" />
                  <span>Lock POS</span>
                </button>
              </div>
            )}
          </div>

          {/* Footer (removed Lock POS button as it's now at top) */}
        </div>
      </DialogContent>
    </Dialog>
  );
}
