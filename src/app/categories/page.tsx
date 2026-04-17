"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { ArrowLeft, Plus, Search, Package, Loader2 } from "lucide-react";
import { useCategories } from "@/lib/hooks/use-categories";
import { useItems } from "@/lib/hooks/use-items";
import { hapticButtonPress } from "@/lib/utils/haptics";
import { QuickAddCategoryDialog } from "../items/quick-add-category-dialog";
import { QuickEditCategoryDialog } from "../items/quick-edit-category-dialog";
import { AssignItemsDialog } from "../items/assign-items-dialog";
import { addCSRFToken } from "@/lib/utils/csrf-client";
import { useToast } from "@/lib/hooks/use-toast";
import { ToastContainer } from "@/components/toast-container";
import { onSyncComplete } from "@/lib/services/unified-sync";

interface Session {
  employee: { id: string; name: string; role: string };
  register: { id: string; name: string; store_name: string };
  org_id: string;
}

export default function CategoriesPage() {
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [assignItemsDialogOpen, setAssignItemsDialogOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [longPressTimer, setLongPressTimer] = useState<any>(null);
  const [longPressFired, setLongPressFired] = useState(false);
  const [wasLongPress, setWasLongPress] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { categories, loading: categoriesLoading, reload: reloadCategories } = useCategories(session?.org_id || "skip");
  const { items, reload } = useItems(session?.org_id || "skip", undefined);

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

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Listen for sync events and reload data
  useEffect(() => {
    if (!session?.org_id) return;
    
    const unsubscribe = onSyncComplete(() => {
      console.log('[Categories] Sync completed, reloading data');
      reloadCategories();
      reload();
    });
    
    return () => {
      unsubscribe();
    };
  }, [session?.org_id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#2d2d2d] flex flex-col overflow-hidden relative">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      
      {/* Loading Overlay */}
      {categoriesLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#3d3d3d] rounded-lg p-6 shadow-xl flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-penkey-orange animate-spin" />
            <p className="text-sm font-medium text-white">Loading categories...</p>
          </div>
        </div>
      )}

      {/* Header */}
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
        <h1 className="font-semibold text-lg">Categories</h1>
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
      </header>

      {/* Search Bar */}
      {searchOpen && (
        <div className="bg-[#3d3d3d] border-b border-gray-700 px-4 py-3">
          <input
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="w-full bg-[#2d2d2d] text-white border border-gray-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-penkey-orange"
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {filteredCategories.length > 0 ? (
          <div className="divide-y divide-gray-700">
            {filteredCategories.map((category) => {
              const isSelected = selectionMode && selectedIds.has(category.id);
              return (
                <div
                  key={category.id}
                  onPointerDown={() => {
                    setLongPressFired(false);
                    setWasLongPress(false);
                    const t = setTimeout(() => {
                      setLongPressFired(true);
                      setWasLongPress(true);
                      setSelectionMode(true);
                      setSelectedIds((prev) => new Set(prev).add(category.id));
                    }, 450);
                    setLongPressTimer(t);
                  }}
                  onPointerUp={() => {
                    if (longPressTimer) {
                      clearTimeout(longPressTimer);
                      setLongPressTimer(null);
                      if (!longPressFired && !selectionMode) {
                        hapticButtonPress();
                        setSelectedCategory(category);
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
                    if (wasLongPress) {
                      setWasLongPress(false);
                      return;
                    }
                    if (selectionMode) {
                      const next = new Set(selectedIds);
                      if (next.has(category.id)) next.delete(category.id); else next.add(category.id);
                      setSelectedIds(next);
                      if (next.size === 0) {
                        setSelectionMode(false);
                      }
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
                  {/* Color Indicator */}
                  <div
                    className="w-10 h-10 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: category.color || "#f97316" }}
                  />
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white text-sm">{category.name}</h3>
                    {category.description && (
                      <p className="text-xs text-gray-400 truncate">{category.description}</p>
                    )}
                  </div>
                  
                  {/* Arrow removed */}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 px-4">
            <Package className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">
              {searchQuery ? "No categories found" : "No categories yet"}
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
              selectedIds.size === filteredCategories.length ? "bg-penkey-orange border-penkey-orange" : "border-gray-500"
            }`}
            onClick={() => {
              if (selectedIds.size === filteredCategories.length) {
                setSelectedIds(new Set());
              } else {
                setSelectedIds(new Set(filteredCategories.map(category => category.id)));
              }
            }}
          >
            {selectedIds.size === filteredCategories.length && (
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            )}
          </div>
          <span className="text-sm text-white mr-auto">{selectedIds.size} selected</span>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            disabled={deleting}
            onClick={async () => {
              if (!session) return;
              const ids = Array.from(selectedIds);
              if (!confirm(`Delete ${ids.length} categor${ids.length === 1 ? 'y' : 'ies'}? This cannot be undone.`)) return;
              
              try {
                setDeleting(true);
                
                // Delete each category via API route
                await Promise.all(
                  ids.map((id) =>
                    fetch(
                      `/api/categories/${id}`,
                      addCSRFToken({
                        method: "DELETE",
                      })
                    ).then(res => {
                      if (!res.ok) throw new Error(`Failed to delete category ${id}`);
                      return res.json();
                    })
                  )
                );
                
                showToast(`Deleted ${ids.length} categor${ids.length === 1 ? 'y' : 'ies'}`, "success");
                reloadCategories(true); // Force refresh
                setSelectionMode(false);
                setSelectedIds(new Set());
              } catch (err: any) {
                console.error("Failed to delete categories:", err);
                showToast(`Failed to delete categories: ${err.message}`, "error");
              } finally {
                setDeleting(false);
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
          <QuickAddCategoryDialog
            open={addDialogOpen}
            onClose={() => setAddDialogOpen(false)}
            orgId={session.org_id}
            onSuccess={() => {
              reloadCategories(true); // Force refresh
              setAddDialogOpen(false);
            }}
          />
          
          {selectedCategory && (
            <>
              <QuickEditCategoryDialog
                open={editDialogOpen}
                onClose={() => {
                  setEditDialogOpen(false);
                  setSelectedCategory(null);
                }}
                category={selectedCategory}
                onSuccess={() => {
                  reloadCategories(true); // Force refresh
                  setEditDialogOpen(false);
                  setSelectedCategory(null);
                }}
                onAssignItems={() => {
                  setEditDialogOpen(false);
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
                  reloadCategories(true); // Force refresh
                  setAssignItemsDialogOpen(false);
                }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
