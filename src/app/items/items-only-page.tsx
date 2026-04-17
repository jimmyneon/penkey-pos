"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@penkey/ui";
import { Plus, Search, ChevronRight, Package, Loader2, Tag, X } from "lucide-react";
import { useCategories } from "@/lib/hooks/use-categories";
import { useItems } from "@/lib/hooks/use-items";
import { formatCurrency } from "@penkey/ui";
import { hapticButtonPress } from "@/lib/utils/haptics";
import { SyncManager } from "@/lib/services/sync-manager"; // Added import
import { QuickAddItemDialog } from "./quick-add-dialog";
import { QuickEditItemDialog } from "./quick-edit-dialog";
import { CategorySelectorDialog } from "../sell/category-selector-dialog";
import { PageHeader } from "@/components/page-header";
import { dataCache } from "@/lib/services/data-cache";
import { clearStore } from "@/lib/idb/db";
import { SelectModifierGroupDialog } from "./select-modifier-group-dialog";
import { useToast } from "@/lib/hooks/use-toast";

interface Session {
  employee: { id: string; name: string; role: string };
  register: { id: string; name: string; store_name: string };
  org_id: string;
}

export default function ItemsOnlyPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | undefined>(undefined);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignCategoryDialogOpen, setAssignCategoryDialogOpen] = useState(false);
  const [modifierDialogOpen, setModifierDialogOpen] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<any>(null);
  const [longPressFired, setLongPressFired] = useState(false);
  const [wasLongPress, setWasLongPress] = useState(false);

  const { categories, loading: categoriesLoading } = useCategories(session?.org_id || "skip");
  const { items, loading: itemsLoading, reload } = useItems(session?.org_id || "skip", undefined);

  useEffect(() => {
    const sessionData = sessionStorage.getItem("pos_session");
    if (!sessionData) {
      router.replace("/lock");
      return;
    }
    try {
      const parsed = JSON.parse(sessionData);
      setSession(parsed);
      setLoading(false);
    } catch (err) {
      console.error("Failed to parse session:", err);
      router.replace("/lock");
    }
  }, [router]);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesCategory = true;
    if (selectedCategoryFilter === "__uncategorised__") {
      // Show items without a category
      matchesCategory = !item.category_id;
    } else if (selectedCategoryFilter) {
      // Show items in selected category
      matchesCategory = item.category_id === selectedCategoryFilter;
    }
    // If no filter, show all items
    
    return matchesSearch && matchesCategory;
  });

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center">
        <div className="bg-[#3d3d3d] rounded-lg p-6 shadow-xl flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-penkey-orange animate-spin" />
          <p className="text-sm font-medium text-white">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#2d2d2d] flex flex-col overflow-hidden relative">
      {/* Loading Overlay */}
      {itemsLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#3d3d3d] rounded-lg p-6 shadow-xl flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-penkey-orange animate-spin" />
            <p className="text-sm font-medium text-white">Loading items...</p>
          </div>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title="Items"
        showBack={true}
        showHome={true}
        showMenu={false}
        backHref="/items-hub"
        session={session}
        rightActions={
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                hapticButtonPress();
                setCategoryDialogOpen(true);
              }}
              className="text-white hover:bg-white/10"
            >
              <Tag className="h-5 w-5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                hapticButtonPress();
                setSearchOpen(!searchOpen);
                if (!searchOpen) {
                  setSearchQuery("");
                }
              }}
              className="text-white hover:bg-white/10"
            >
              <Search className="h-5 w-5" />
            </Button>
          </>
        }
      />

      {/* Search Bar */}
      {searchOpen && (
        <div className="bg-[#3d3d3d] border-b border-gray-700 px-4 py-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full bg-[#2d2d2d] text-white border border-gray-600 rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:border-penkey-orange"
            />
            {searchQuery ? (
              <button
                onClick={() => {
                  hapticButtonPress();
                  setSearchQuery("");
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={() => {
                  hapticButtonPress();
                  setSearchOpen(false);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {filteredItems.length > 0 ? (
          <div className="divide-y divide-gray-700">
            {filteredItems.map((item) => {
              const price = item.has_variants
                ? item.item_variants?.[0]?.price || 0
                : item.base_price || 0;
              const isSelected = selectedIds.has(item.id);
              
              return (
                <div
                  key={item.id}
                  onPointerDown={() => {
                    // start long press
                    setLongPressFired(false);
                    setWasLongPress(false);
                    const t = setTimeout(() => {
                      setLongPressFired(true);
                      setWasLongPress(true);
                      setSelectionMode(true);
                      setSelectedIds((prev) => new Set(prev).add(item.id));
                    }, 450);
                    setLongPressTimer(t);
                  }}
                  onPointerUp={() => {
                    if (longPressTimer) {
                      clearTimeout(longPressTimer);
                      setLongPressTimer(null);
                      // Only open edit dialog if long press didn't fire
                      if (!longPressFired && !selectionMode) {
                        hapticButtonPress();
                        setSelectedItem(item);
                        setEditDialogOpen(true);
                      }
                    }
                  }}
                  onPointerLeave={() => {
                    if (longPressTimer) {
                      clearTimeout(longPressTimer);
                      setLongPressTimer(null);
                      setLongPressFired(false);
                    }
                  }}
                  onClick={() => {
                    // Skip toggle if it was a long press
                    if (wasLongPress) {
                      setWasLongPress(false);
                      return;
                    }
                    if (selectionMode) {
                      const next = new Set(selectedIds);
                      if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                      setSelectedIds(next);
                      if (next.size === 0) {
                        setSelectionMode(false);
                      }
                    }
                  }}
                  className="w-full bg-[#3d3d3d] hover:bg-[#4d4d4d] transition-colors p-4 flex items-center gap-3 text-left"
                >
                  {/* Checkbox for selection mode */}
                  {selectionMode && (
                    <div
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? "bg-penkey-orange border-penkey-orange" : "border-gray-500"
                      }`}
                    >
                      {isSelected && (
                        <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      )}
                    </div>
                  )}
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
                      {!item.is_active && (
                        <Badge variant="outline" className="text-xs text-gray-500 border-gray-600">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      {item.categories && (
                        <span>{item.categories.name}</span>
                      )}
                      {item.has_variants && (
                        <span>• {item.item_variants?.length || 0} variants</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-penkey-orange font-semibold">
                      {formatCurrency(price)}
                    </span>
                    <ChevronRight className="h-5 w-5 text-gray-500" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 px-4">
            <Package className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">
              {searchQuery ? "No items found" : "No items yet"}
            </p>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => {
          hapticButtonPress();
          setAddDialogOpen(true);
        }}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-penkey-orange hover:bg-penkey-orange/90 shadow-lg flex items-center justify-center transition-all"
      >
        <Plus className="h-7 w-7 text-white" />
      </button>

      {/* Bulk actions bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#3d3d3d] border-t border-gray-700 p-3 flex items-center gap-2 z-40">
          <div
            className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer ${
              selectedIds.size === filteredItems.length ? "bg-penkey-orange border-penkey-orange" : "border-gray-500"
            }`}
            onClick={() => {
              if (selectedIds.size === filteredItems.length) {
                setSelectedIds(new Set());
              } else {
                setSelectedIds(new Set(filteredItems.map(item => item.id)));
              }
            }}
          >
            {selectedIds.size === filteredItems.length && (
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            )}
          </div>
          <span className="text-sm text-white mr-auto">{selectedIds.size} selected</span>
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => setAssignCategoryDialogOpen(true)}
          >
            Add to category
          </Button>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => setModifierDialogOpen(true)}
          >
            Add modifiers
          </Button>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={async () => {
              if (!session) return;
              if (!confirm(`Delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
              
              try {
                if (!session) {
                  showToast('Session expired. Please log in again.', 'error');
                  return;
                }
                
                const ids = Array.from(selectedIds);
                console.log(`[BulkDelete] Starting deletion of ${ids.length} items:`, ids);
                
                const results = await Promise.all(
                  ids.map(async (id) => {
                    console.log(`[BulkDelete] Deleting item ${id}...`);
                    const response = await fetch(`/api/items/${id}`, {
                      method: 'DELETE',
                      credentials: 'same-origin', // Include cookies
                    });
                    console.log(`[BulkDelete] Response for ${id}:`, response.status, response.ok);
                    return response;
                  })
                );
                
                // Check for errors
                for (let i = 0; i < results.length; i++) {
                  const res = results[i];
                  if (!res.ok) {
                    const error = await res.json();
                    console.error(`[BulkDelete] Failed to delete item ${ids[i]}:`, error);
                    throw new Error(error.error || 'Failed to delete item');
                  }
                }
                
                console.log(`[BulkDelete] Successfully deleted ${ids.length} items from API`);
                
                // Clear cache, sync timestamp, and IndexedDB
                dataCache.clear(session.org_id, "items");
                SyncManager.clearSyncTimestamp(session.org_id, "ITEMS");
                await clearStore("items"); // Clear IndexedDB to remove stale data
                
                showToast(`${ids.length} item(s) deleted successfully`, "success");
                setSelectionMode(false);
                setSelectedIds(new Set());
                reload(true);
              } catch (error: any) {
                console.error("Failed to delete items:", error);
                showToast(`Failed to delete items: ${error.message}`, "error");
              }
            }}
          >
            Delete
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10"
            onClick={() => {
              setSelectionMode(false);
              setSelectedIds(new Set());
            }}
          >
            Done
          </Button>
        </div>
      )}

      {/* Dialogs */}
      {session && (
        <>
          <QuickAddItemDialog
            open={addDialogOpen}
            onClose={() => setAddDialogOpen(false)}
            orgId={session.org_id}
            categories={categories}
            onSuccess={() => {
              // Clear cache so new item appears
              dataCache.clear(session.org_id, "items");
              SyncManager.clearSyncTimestamp(session.org_id, "ITEMS");
              reload();
              setAddDialogOpen(false);
            }}
          />
          
          {selectedItem && (
            <QuickEditItemDialog
              open={editDialogOpen}
              onClose={() => {
                setEditDialogOpen(false);
                setSelectedItem(null);
              }}
              item={selectedItem}
              categories={categories}
              orgId={session.org_id}
              onSuccess={() => {
                // Clear cache so edited item updates
                dataCache.clear(session.org_id, "items");
                SyncManager.clearSyncTimestamp(session.org_id, "ITEMS");
                reload();
                setEditDialogOpen(false);
                setSelectedItem(null);
              }}
            />
          )}
        </>
      )}

      {/* Category Selector Dialog */}
      <CategorySelectorDialog
        open={categoryDialogOpen}
        onClose={() => setCategoryDialogOpen(false)}
        categories={categories}
        selectedCategory={selectedCategoryFilter}
        onSelectCategory={(categoryId: string | undefined) => {
          setSelectedCategoryFilter(categoryId);
          setCategoryDialogOpen(false);
        }}
        showUncategorised={true}
      />

      {/* Assign Category Dialog for bulk action */}
      <CategorySelectorDialog
        open={assignCategoryDialogOpen}
        onClose={() => setAssignCategoryDialogOpen(false)}
        categories={categories}
        selectedCategory={undefined}
        onSelectCategory={async (categoryId: string | undefined) => {
          if (!session) return;
          try {
            const ids = Array.from(selectedIds);
            // Convert empty string or undefined to null for UUID column
            const finalCategoryId = categoryId === "" || !categoryId ? null : categoryId;
            console.log('[BulkAssignCategory] Assigning', ids.length, 'items to category:', finalCategoryId);
            
            // Use API route instead of direct Supabase client (bypasses RLS)
            const sessionData = sessionStorage.getItem('pos_session');
            if (!sessionData) {
              showToast('Session expired. Please log in again.', 'error');
              return;
            }
            
            const results = await Promise.all(
              ids.map((id) =>
                fetch(`/api/items/${id}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-pos-session': sessionData,
                  },
                  body: JSON.stringify({ category_id: finalCategoryId }),
                })
              )
            );
            
            console.log('[BulkAssignCategory] Update results:', results);
            
            // Check for errors
            for (const res of results) {
              if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to update item');
              }
            }
            
            // Force hard refresh - clear cache and sync timestamp
            console.log('[BulkAssignCategory] Clearing cache...');
            dataCache.clear(session.org_id, "items");
            console.log('[BulkAssignCategory] Clearing sync timestamp...');
            SyncManager.clearSyncTimestamp(session.org_id, "ITEMS");
            console.log('[BulkAssignCategory] Cache and timestamp cleared');
            
            const categoryName = categories.find(c => c.id === categoryId)?.name || "No Category";
            const message = `${ids.length} item(s) added to ${categoryName}`;
            console.log('[BulkAssignCategory] Showing toast:', message);
            showToast(message, "success");
            
            setAssignCategoryDialogOpen(false);
            setSelectionMode(false);
            setSelectedIds(new Set());
            
            // Force reload with skipCache=true to bypass IDB
            console.log('[BulkAssignCategory] About to call reload(true)');
            reload(true);
            console.log('[BulkAssignCategory] reload(true) called');
          } catch (error) {
            console.error("Failed to assign category:", error);
            showToast("Failed to assign category", "error");
          }
        }}
        showUncategorised={true}
      />

      {/* Select Modifier Group Dialog for bulk action */}
      {session && (
        <SelectModifierGroupDialog
          open={modifierDialogOpen}
          onClose={() => setModifierDialogOpen(false)}
          orgId={session.org_id}
          multiSelect
          onAssign={async (groups) => {
            try {
              const itemIds = Array.from(selectedIds);
              await Promise.all(
                groups.map((g) =>
                  fetch(`/api/items/modifiers/assign`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ modifier_group_id: g.id, item_ids: itemIds }),
                  })
                )
              );
              // Clear cache and trigger full refresh
              dataCache.clear(session.org_id, "items");
              SyncManager.clearSyncTimestamp(session.org_id, "ITEMS");
              // Also clear modifier groups cache
              SyncManager.clearSyncTimestamp(session.org_id, "MODIFIERS");
              showToast(`${itemIds.length} item(s) assigned to ${groups.length} modifier group(s)`, "success");
              setModifierDialogOpen(false);
              setSelectionMode(false);
              setSelectedIds(new Set());
              reload(true);
            } catch (e) {
              console.error(e);
              showToast("Failed to assign modifier groups", "error");
            }
          }}
        />
      )}
    </div>
  );
}
