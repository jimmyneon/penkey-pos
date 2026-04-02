"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@penkey/ui";
import { ArrowLeft, Plus, Search, ChevronRight, Package, Loader2, Tag } from "lucide-react";
import { useCategories } from "@/lib/hooks/use-categories";
import { useItems } from "@/lib/hooks/use-items";
import { useModifiers } from "@/lib/hooks/use-modifiers";
import { formatCurrency } from "@penkey/ui";
import { hapticButtonPress } from "@/lib/utils/haptics";
import { QuickAddItemDialog } from "./quick-add-dialog";
import { QuickEditItemDialog } from "./quick-edit-dialog";
import { QuickAddCategoryDialog } from "./quick-add-category-dialog";
import { QuickEditCategoryDialog } from "./quick-edit-category-dialog";
import { AssignItemsDialog } from "./assign-items-dialog";
import { QuickAddModifierDialog } from "./quick-add-modifier-dialog";
import { QuickEditModifierDialog } from "./quick-edit-modifier-dialog";
import { CategorySelectorDialog } from "../sell/category-selector-dialog";
import { dataCache } from "@/lib/services/data-cache";
import { invalidateAllModifiers } from "@/lib/services/modifier-cache";
import { createSupabaseClient } from "@penkey/database";
import { SyncManager } from "@/lib/services/sync-manager"; // Added SyncManager import

interface Session {
  employee: { id: string; name: string; role: string };
  register: { id: string; name: string; store_name: string };
  org_id: string;
}

interface ModifierGroup {
  id: string;
  name: string;
  selection_type: string;
  min_selections: number;
  max_selections: number | null;
  modifier_options: ModifierOption[];
}

interface ModifierOption {
  id: string;
  name: string;
  price_adjustment: number;
  is_active: boolean;
  sort_order: number;
}

export default function ManagementPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"items" | "categories" | "modifiers">("items");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | undefined>(undefined);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [addCategoryDialogOpen, setAddCategoryDialogOpen] = useState(false);
  const [editCategoryDialogOpen, setEditCategoryDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [assignItemsDialogOpen, setAssignItemsDialogOpen] = useState(false);
  const [addModifierDialogOpen, setAddModifierDialogOpen] = useState(false);
  const [editModifierDialogOpen, setEditModifierDialogOpen] = useState(false);
  const [selectedModifierGroup, setSelectedModifierGroup] = useState<ModifierGroup | null>(null);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [longPressTimer, setLongPressTimer] = useState<any>(null);

  const { categories, loading: categoriesLoading, reload: reloadCategories } = useCategories(session?.org_id || "skip");
  const { items, loading: itemsLoading, reload } = useItems(session?.org_id || "skip", undefined);
  const [modifierGroupsLoading, setModifierGroupsLoading] = useState(false);

  useEffect(() => {
    const sessionData = sessionStorage.getItem("pos_session");
    if (!sessionData) {
      router.replace("/lock"); // Use replace instead of push to avoid back button issues
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

  // Fetch modifier groups with options
  useEffect(() => {
    if (session?.org_id && activeTab === "modifiers") {
      fetchModifierGroups();
    }
  }, [session?.org_id, activeTab]);

  const fetchModifierGroups = async () => {
    try {
      setModifierGroupsLoading(true);
      
      // Clear old modifier cache (from individual options endpoint)
      dataCache.clear(session!.org_id, "modifiers");
      
      // Try cache first
      const cached = dataCache.get<ModifierGroup[]>(session!.org_id, "modifier_groups");
      if (cached) {
        console.log("[fetchModifierGroups] Using cached groups:", cached.length, cached);
        setModifierGroups(cached);
        setModifierGroupsLoading(false);
        return;
      }

      // Fetch from API
      console.log("[fetchModifierGroups] Fetching from API...");
      const response = await fetch(`/api/modifiers/groups?org_id=${session?.org_id}`);
      if (!response.ok) throw new Error("Failed to fetch modifier groups");
      const data = await response.json();
      
      console.log("[fetchModifierGroups] Received data:", data.length, data);
      
      // Cache the data
      dataCache.set(session!.org_id, "modifier_groups", data);
      
      setModifierGroups(data);
    } catch (err) {
      console.error("Failed to load modifier groups:", err);
    } finally {
      setModifierGroupsLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = !selectedCategoryFilter || 
      item.category_id === selectedCategoryFilter;
    
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
      {(itemsLoading || categoriesLoading || modifierGroupsLoading) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#3d3d3d] rounded-lg p-6 shadow-xl flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-penkey-orange animate-spin" />
            <p className="text-sm font-medium text-white">
              {itemsLoading ? "Loading items..." : categoriesLoading ? "Loading categories..." : "Loading modifiers..."}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-[#3d3d3d] text-white px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => router.push("/sell")}
          className="text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </Button>
        <h1 className="font-semibold text-lg">Management</h1>
        <div className="flex items-center gap-2">
          {activeTab === "items" && (
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
          )}
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
        </div>
      </header>

      {/* Submenu Tabs */}
      <div className="bg-[#3d3d3d] border-b border-gray-700">
        <div className="flex">
          <button
            onClick={() => {
              hapticButtonPress();
              setActiveTab("items");
            }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === "items"
                ? "text-white border-b-2 border-penkey-orange"
                : "text-gray-400"
            }`}
          >
            Items
          </button>
          <button
            onClick={() => {
              hapticButtonPress();
              setActiveTab("categories");
            }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === "categories"
                ? "text-white border-b-2 border-penkey-orange"
                : "text-gray-400"
            }`}
          >
            Categories
          </button>
          <button
            onClick={() => {
              hapticButtonPress();
              setActiveTab("modifiers");
            }}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === "modifiers"
                ? "text-white border-b-2 border-penkey-orange"
                : "text-gray-400"
            }`}
          >
            Modifiers
          </button>
        </div>
      </div>

      {/* Search Bar (Collapsible) */}
      {searchOpen && (
        <div className="bg-[#3d3d3d] border-b border-gray-700 px-4 py-3">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="w-full bg-[#2d2d2d] text-white border border-gray-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-penkey-orange"
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {activeTab === "items" && (
          <>
            {filteredItems.length > 0 ? (
              <div className="divide-y divide-gray-700">
                {filteredItems.map((item) => {
                  const price = item.has_variants
                    ? item.item_variants?.[0]?.price || 0
                    : item.base_price || 0;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        hapticButtonPress();
                        setSelectedItem(item);
                        setEditDialogOpen(true);
                      }}
                      className="w-full bg-[#3d3d3d] hover:bg-[#4d4d4d] transition-colors p-4 flex items-center gap-3 text-left"
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
                    </button>
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
          </>
        )}

        {activeTab === "categories" && (
          <>
            {categories.length > 0 ? (
              <div className="divide-y divide-gray-700">
                {categories.map((category) => {
                  const isSelected = selectionMode && selectedIds.has(category.id);
                  return (
                    <div
                      key={category.id}
                      onPointerDown={() => {
                        const t = setTimeout(() => {
                          setSelectionMode(true);
                          setSelectedIds((prev) => new Set(prev).add(category.id));
                        }, 450);
                        setLongPressTimer(t);
                      }}
                      onPointerUp={() => {
                        if (longPressTimer) {
                          clearTimeout(longPressTimer);
                          setLongPressTimer(null);
                          if (!selectionMode) {
                            hapticButtonPress();
                            setSelectedCategory(category);
                            setEditCategoryDialogOpen(true);
                          }
                        }
                      }}
                      onPointerLeave={() => {
                        if (longPressTimer) {
                          clearTimeout(longPressTimer);
                          setLongPressTimer(null);
                        }
                      }}
                      onClick={() => {
                        if (selectionMode) {
                          const next = new Set(selectedIds);
                          if (next.has(category.id)) next.delete(category.id); else next.add(category.id);
                          setSelectedIds(next);
                        }
                      }}
                      className="w-full bg-[#3d3d3d] hover:bg-[#4d4d4d] transition-colors p-4 flex items-center gap-3 text-left"
                    >
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
                      <div
                        className="w-10 h-10 rounded-lg flex-shrink-0"
                        style={{ backgroundColor: category.color || "#f97316" }}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white text-sm">{category.name}</h3>
                        {category.description && (
                          <p className="text-xs text-gray-400 truncate">{category.description}</p>
                        )}
                      </div>
                      
                      <ChevronRight className="h-5 w-5 text-gray-500" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 px-4">
                <Package className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No categories yet</p>
              </div>
            )}
          </>
        )}

        {activeTab === "modifiers" && (
          <>
            {modifierGroups.length > 0 ? (
              <div className="divide-y divide-gray-700">
                {modifierGroups.map((group) => {
                  const isSelected = selectionMode && selectedIds.has(group.id);
                  return (
                    <div
                      key={group.id}
                      onPointerDown={() => {
                        const t = setTimeout(() => {
                          setSelectionMode(true);
                          setSelectedIds((prev) => new Set(prev).add(group.id));
                        }, 450);
                        setLongPressTimer(t);
                      }}
                      onPointerUp={() => {
                        if (longPressTimer) {
                          clearTimeout(longPressTimer);
                          setLongPressTimer(null);
                          if (!selectionMode) {
                            hapticButtonPress();
                            setSelectedModifierGroup(group);
                            setEditModifierDialogOpen(true);
                          }
                        }
                      }}
                      onPointerLeave={() => {
                        if (longPressTimer) {
                          clearTimeout(longPressTimer);
                          setLongPressTimer(null);
                        }
                      }}
                      onClick={() => {
                        if (selectionMode) {
                          const next = new Set(selectedIds);
                          if (next.has(group.id)) next.delete(group.id); else next.add(group.id);
                          setSelectedIds(next);
                        }
                      }}
                      className="w-full bg-[#3d3d3d] hover:bg-[#4d4d4d] transition-colors p-4 flex items-center gap-3 text-left"
                    >
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
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white text-sm mb-1">{group.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span className="capitalize">{group.selection_type}</span>
                          <span>• {group.modifier_options?.length || 0} options</span>
                          {group.min_selections > 0 && (
                            <span>• Min: {group.min_selections}</span>
                          )}
                          {group.max_selections && (
                            <span>• Max: {group.max_selections}</span>
                          )}
                        </div>
                      </div>
                      
                      <ChevronRight className="h-5 w-5 text-gray-500" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 px-4">
                <Package className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No modifier groups yet</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => {
          hapticButtonPress();
          if (activeTab === "items") {
            setAddDialogOpen(true);
          } else if (activeTab === "categories") {
            setAddCategoryDialogOpen(true);
          } else if (activeTab === "modifiers") {
            setAddModifierDialogOpen(true);
          }
        }}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-penkey-orange hover:bg-penkey-orange/90 shadow-lg flex items-center justify-center transition-all"
      >
        <Plus className="h-7 w-7 text-white" />
      </button>

      {/* Bulk actions bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#3d3d3d] border-t border-gray-700 p-3 flex items-center gap-2 z-40">
          <span className="text-sm text-white mr-auto">{selectedIds.size} selected</span>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={async () => {
              if (!session) return;
              const ids = Array.from(selectedIds);
              if (activeTab === "categories") {
                if (!confirm(`Delete ${ids.length} categor${ids.length === 1 ? 'y' : 'ies'}? This cannot be undone.`)) return;
                const supabase = createSupabaseClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                );
                await Promise.all(
                  ids.map((id) =>
                    supabase.from("categories").update({ is_active: false }).eq("id", id)
                  )
                );
                reloadCategories();
              } else if (activeTab === "modifiers") {
                if (!confirm(`Delete ${ids.length} modifier group${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
                const supabase = createSupabaseClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                );
                await Promise.all(
                  ids.map((id) =>
                    supabase.from("modifier_groups").delete().eq("id", id)
                  )
                );
                dataCache.clear(session.org_id, "modifier_groups");
                fetchModifierGroups();
              }
              setSelectionMode(false);
              setSelectedIds(new Set());
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
          {/* Item Dialogs */}
          <QuickAddItemDialog
            open={addDialogOpen}
            onClose={() => setAddDialogOpen(false)}
            orgId={session.org_id}
            categories={categories}
            onSuccess={() => {
              // Invalidate items cache and sync timestamp
              dataCache.clear(session.org_id, "items");
              SyncManager.clearSyncTimestamp(session.org_id, "ITEMS");
              reload(true); // Force refresh from API
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
                // Invalidate items cache and sync timestamp
                dataCache.clear(session.org_id, "items");
                SyncManager.clearSyncTimestamp(session.org_id, "ITEMS");
                reload(true); // Force refresh from API
                setEditDialogOpen(false);
                setSelectedItem(null);
              }}
            />
          )}

          {/* Category Dialogs */}
          <QuickAddCategoryDialog
            open={addCategoryDialogOpen}
            onClose={() => setAddCategoryDialogOpen(false)}
            orgId={session.org_id}
            onSuccess={() => {
              SyncManager.clearSyncTimestamp(session.org_id, "CATEGORIES");
              reloadCategories();
              setAddCategoryDialogOpen(false);
            }}
          />
          
          {selectedCategory && (
            <>
              <QuickEditCategoryDialog
                open={editCategoryDialogOpen}
                onClose={() => {
                  setEditCategoryDialogOpen(false);
                  setSelectedCategory(null);
                }}
                category={selectedCategory}
                onSuccess={() => {
                  SyncManager.clearSyncTimestamp(session.org_id, "CATEGORIES");
                  reloadCategories();
                  setEditCategoryDialogOpen(false);
                  setSelectedCategory(null);
                }}
                onAssignItems={() => {
                  setEditCategoryDialogOpen(false);
                  setTimeout(() => {
                    setAssignItemsDialogOpen(true);
                  }, 100);
                }}
              />
              
              <AssignItemsDialog
                open={assignItemsDialogOpen}
                onClose={() => setAssignItemsDialogOpen(false)}
                category={selectedCategory}
                items={items}
                onSuccess={() => {
                  reload();
                  reloadCategories();
                  setAssignItemsDialogOpen(false);
                }}
              />
            </>
          )}

          {/* Modifier Dialogs */}
          <QuickAddModifierDialog
            open={addModifierDialogOpen}
            onClose={() => setAddModifierDialogOpen(false)}
            orgId={session.org_id}
            onSuccess={() => {
              fetchModifierGroups();
              setAddModifierDialogOpen(false);
            }}
          />
          
          {selectedModifierGroup && (
            <QuickEditModifierDialog
              open={editModifierDialogOpen}
              onClose={() => {
                setEditModifierDialogOpen(false);
                setSelectedModifierGroup(null);
              }}
              modifier={selectedModifierGroup}
              onSuccess={() => {
                fetchModifierGroups();
                setEditModifierDialogOpen(false);
                setSelectedModifierGroup(null);
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
      />
    </div>
  );
}
