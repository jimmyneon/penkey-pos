"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Star, Loader2, Search, Check, RefreshCw, ChevronUp, ChevronDown } from "lucide-react";
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
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
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
    const newFavStatus = !item.is_favourite;
    
    // Optimistic UI update - update immediately
    setItems(items.map(i => 
      i.id === item.id ? { ...i, is_favourite: newFavStatus } : i
    ));
    hapticSuccess();

    // Sync in background without blocking UI
    fetch("/api/items/favourite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_id: item.id,
        is_favourite: newFavStatus,
      }),
    }).then(async (response) => {
      if (!response.ok) throw new Error("Failed to update favourite");
      const data = await response.json();

      // Update local IndexedDB cache for this item
      if (session?.org_id) {
        try {
          const { getAll, putMany } = await import("@/lib/idb/db");
          const allItems = await getAll("items");
          const updatedItems = allItems.map((i: any) => 
            i.id === item.id ? { ...i, is_favourite: newFavStatus } : i
          );
          await putMany("items", updatedItems);
        } catch (error) {
          console.error("Failed to update local cache:", error);
        }
      }
    }).catch((error) => {
      console.error("Failed to toggle favourite:", error);
      // Revert UI on error
      setItems(items.map(i => 
        i.id === item.id ? { ...i, is_favourite: item.is_favourite } : i
      ));
      alert("Failed to update favourite");
    });
  };

  const moveFavouriteUp = async (item: any, currentIndex: number) => {
    if (currentIndex === 0) return; // Already at top
    
    const favouriteItems = filteredItems.filter((i: any) => i.is_favourite);
    const itemIndex = favouriteItems.findIndex((i: any) => i.id === item.id);
    
    if (itemIndex === 0) return; // Already at top of favourites
    
    // Swap positions with item above
    const itemAbove = favouriteItems[itemIndex - 1];
    const newPosition = itemAbove.favourite_position || 0;
    const abovePosition = item.favourite_position || 0;
    
    // Optimistic UI update
    setItems(items.map((i: any) => {
      if (i.id === item.id) return { ...i, favourite_position: newPosition };
      if (i.id === itemAbove.id) return { ...i, favourite_position: abovePosition };
      return i;
    }));
    hapticSuccess();

    // Sync positions in background
    fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favourite_position: newPosition }),
    }).catch((error) => {
      console.error("Failed to move item up:", error);
      alert("Failed to update position");
    });

    fetch(`/api/items/${itemAbove.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favourite_position: abovePosition }),
    }).catch((error) => {
      console.error("Failed to move item down:", error);
    });
  };

  const moveFavouriteDown = async (item: any, currentIndex: number) => {
    const favouriteItems = filteredItems.filter((i: any) => i.is_favourite);
    const itemIndex = favouriteItems.findIndex((i: any) => i.id === item.id);
    
    if (itemIndex === favouriteItems.length - 1) return; // Already at bottom
    
    // Swap positions with item below
    const itemBelow = favouriteItems[itemIndex + 1];
    const newPosition = itemBelow.favourite_position || 0;
    const belowPosition = item.favourite_position || 0;
    
    // Optimistic UI update
    setItems(items.map((i: any) => {
      if (i.id === item.id) return { ...i, favourite_position: newPosition };
      if (i.id === itemBelow.id) return { ...i, favourite_position: belowPosition };
      return i;
    }));
    hapticSuccess();

    // Sync positions in background
    fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favourite_position: newPosition }),
    }).catch((error) => {
      console.error("Failed to move item down:", error);
      alert("Failed to update position");
    });

    fetch(`/api/items/${itemBelow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favourite_position: belowPosition }),
    }).catch((error) => {
      console.error("Failed to move item up:", error);
    });
  };

  const filteredItems = items.filter(item => {
    const searchLower = searchQuery.toLowerCase();
    // Always filter by contains (consistent behavior for all query lengths)
    return item.name.toLowerCase().includes(searchLower);
  });

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
              filteredItems.map((item, index) => {
                const favouriteItems = filteredItems.filter((i: any) => i.is_favourite);
                const favIndex = favouriteItems.findIndex((i: any) => i.id === item.id);
                const isFavourite = item.is_favourite;
                
                return (
                  <div
                    key={item.id}
                    className="w-full bg-[#2d2d2d] rounded-lg p-4 flex items-center justify-between"
                  >
                    <button
                      onClick={() => toggleFavourite(item)}
                      className="flex-1 min-w-0 flex items-center justify-between text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium text-sm truncate">{item.name}</h3>
                        <p className="text-penkey-orange font-semibold text-sm">
                          {formatCurrency(item.base_price)}
                        </p>
                      </div>
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ml-3 ${
                          isFavourite
                            ? "bg-yellow-400 text-[#2d2d2d]"
                            : "bg-gray-600 text-gray-400"
                        }`}
                      >
                        {isFavourite ? <Check className="h-5 w-5" /> : null}
                      </div>
                    </button>
                    {isFavourite && (
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveFavouriteUp(item, favIndex);
                          }}
                          disabled={favIndex === 0}
                          className="p-1 rounded hover:bg-[#4d4d4d] disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronUp className="h-5 w-5 text-white" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveFavouriteDown(item, favIndex);
                          }}
                          disabled={favIndex === favouriteItems.length - 1}
                          className="p-1 rounded hover:bg-[#4d4d4d] disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronDown className="h-5 w-5 text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
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
