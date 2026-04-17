"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Star, Loader2, Search, Check, RefreshCw } from "lucide-react";
import { Button } from "@penkey/ui";
import { formatCurrency } from "@penkey/ui";
import { hapticSuccess, hapticButtonPress } from "@/lib/utils/haptics";
import { dataCache } from "@/lib/services/data-cache";
import { SyncManager } from "@/lib/services/sync-manager";
import { prefetchOrgData } from "@/lib/offline/prefetch";

interface Session {
  employee: { id: string; name: string; role: string };
  register: { id: string; name: string; store_name: string };
  org_id: string;
}

export default function FavouritesPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const sessionData = sessionStorage.getItem("pos_session");
    if (!sessionData) {
      router.push("/lock");
      return;
    }
    try {
      const parsed = JSON.parse(sessionData);
      setSession(parsed);
    } catch (err) {
      console.error("Failed to parse session:", err);
      router.push("/lock");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (session) {
      fetchItems();
    }
  }, [session]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/items?org_id=${session?.org_id}`);
      if (!response.ok) throw new Error("Failed to fetch items");
      
      const data = await response.json();
      setItems(data);
    } catch (error) {
      console.error("Failed to fetch items:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavourite = async (item: any) => {
    try {
      setSaving(true);
      hapticButtonPress();
      
      const response = await fetch("/api/items/favourite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: item.id,
          is_favourite: !item.is_favourite,
        }),
      });

      if (!response.ok) throw new Error("Failed to update favourite");

      const data = await response.json();

      // Update local state
      setItems(items.map(i => 
        i.id === item.id ? { ...i, is_favourite: !item.is_favourite } : i
      ));
      
      hapticSuccess();

      // Trigger full data sync if required
      if (data.sync_required && session?.org_id) {
        setSyncing(true);
        console.log("[Favourites] Syncing local database...");
        
        // Clear cache and sync timestamps
        dataCache.clear(session.org_id, "items");
        dataCache.clear(session.org_id, "categories");
        dataCache.clear(session.org_id, "modifiers");
        dataCache.clear(session.org_id, "discounts");
        SyncManager.clearSyncTimestamp(session.org_id, "ITEMS");
        SyncManager.clearSyncTimestamp(session.org_id, "CATEGORIES");
        SyncManager.clearSyncTimestamp(session.org_id, "MODIFIERS");

        // Full data resync
        await prefetchOrgData(session.org_id);
        
        setSyncing(false);
        console.log("[Favourites] Local database synced");
      }
    } catch (error) {
      console.error("Failed to toggle favourite:", error);
      alert("Failed to update favourite");
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const favouriteCount = items.filter(item => item.is_favourite).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-penkey-orange animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#2d2d2d]">
      {/* Header */}
      <header className="bg-[#3d3d3d] text-white px-4 py-4 flex items-center gap-4 border-b border-gray-700">
        <Button
          size="sm"
          variant="ghost"
          className="text-white hover:bg-white/10 p-2"
          onClick={() => router.push("/items-hub")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <Star className="h-6 w-6 text-yellow-400" />
          <h1 className="text-xl font-semibold">Favourites</h1>
          <span className="text-sm text-gray-400">({favouriteCount} items)</span>
        </div>
        {syncing && (
          <div className="flex items-center gap-2 text-sm text-penkey-orange">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Syncing...</span>
          </div>
        )}
      </header>

      {/* Content */}
      <div className="p-4 sm:p-6">
        <div className="bg-[#3d3d3d] rounded-lg p-6 border border-gray-700">
          <p className="text-gray-400 text-sm mb-4">
            Select items to appear in the favourites section on the sell screen for quick access.
          </p>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#2d2d2d] text-white border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-penkey-orange"
            />
          </div>

          {/* Items List */}
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleFavourite(item)}
                  disabled={saving}
                  className="w-full bg-[#2d2d2d] hover:bg-[#4d4d4d] transition-colors rounded-lg p-4 flex items-center justify-between text-left disabled:opacity-50"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium text-sm truncate">{item.name}</h3>
                    <p className="text-penkey-orange font-semibold text-sm">
                      {formatCurrency(item.base_price)}
                    </p>
                  </div>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ml-3 ${
                      item.is_favourite
                        ? "bg-yellow-400 text-[#2d2d2d]"
                        : "bg-gray-600 text-gray-400"
                    }`}
                  >
                    {item.is_favourite ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Star className="h-4 w-4" />
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-12 text-gray-400">
                {searchQuery ? "No items found" : "No items available"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
