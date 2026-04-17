"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { ArrowLeft, Plus, Search, Package, Loader2, ChevronUp, ChevronDown } from "lucide-react";
import { formatCurrency } from "@penkey/ui";
import { hapticButtonPress } from "@/lib/utils/haptics";
import { QuickAddModifierDialog } from "../items/quick-add-modifier-dialog";
import { AssignModifierDialog } from "./assign-modifier-dialog";
import { dataCache } from "@/lib/services/data-cache";
import { invalidateAllModifiers } from "@/lib/services/modifier-cache";
import { addCSRFToken } from "@/lib/utils/csrf-client";
import { useToast } from "@/lib/hooks/use-toast";
import { ToastContainer } from "@/components/toast-container";
import { PageHeader } from "@/components/page-header";
import { onSyncComplete } from "@/lib/services/unified-sync";

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
  sort_order: number;
  modifier_options: ModifierOption[];
}

interface ModifierOption {
  id: string;
  name: string;
  price_adjustment: number;
  is_active: boolean;
  sort_order: number;
}

export default function ModifiersPage() {
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignBulkOpen, setAssignBulkOpen] = useState(false);
  
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [modifierGroupsLoading, setModifierGroupsLoading] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [longPressTimer, setLongPressTimer] = useState<any>(null);
  const [longPressFired, setLongPressFired] = useState(false);
  const [wasLongPress, setWasLongPress] = useState(false);
  const [reordering, setReordering] = useState(false);

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

  useEffect(() => {
    if (session?.org_id) {
      fetchModifierGroups();
    }
  }, [session?.org_id]);

  // Listen for sync events and reload data
  useEffect(() => {
    if (!session?.org_id) return;
    
    const unsubscribe = onSyncComplete(() => {
      console.log('[Modifiers] Sync completed, reloading data');
      fetchModifierGroups(true);
    });
    
    return () => {
      unsubscribe();
    };
  }, [session?.org_id]);

  const fetchModifierGroups = async (forceRefresh = false) => {
    try {
      setModifierGroupsLoading(true);
      
      // Try cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = dataCache.get<ModifierGroup[]>(session!.org_id, "modifier_groups");
        if (cached) {
          console.log("[Modifiers] Using cached groups:", cached.length);
          setModifierGroups(cached);
          setModifierGroupsLoading(false);
          return;
        }
      }

      // Fetch from API
      const response = await fetch(`/api/modifiers/groups?org_id=${session?.org_id}`);
      if (!response.ok) throw new Error("Failed to fetch modifier groups");
      const data = await response.json();
      
      // Cache the data
      dataCache.set(session!.org_id, "modifier_groups", data);
      
      setModifierGroups(data);
    } catch (err) {
      console.error("Failed to load modifier groups:", err);
    } finally {
      setModifierGroupsLoading(false);
    }
  };

  const filteredGroups = modifierGroups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const moveGroup = async (groupId: string, direction: 'up' | 'down') => {
    const index = filteredGroups.findIndex(g => g.id === groupId);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === filteredGroups.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newGroups = [...filteredGroups];
    [newGroups[index], newGroups[newIndex]] = [newGroups[newIndex], newGroups[index]];

    // Update sort_order for all groups
    newGroups.forEach((g, idx) => {
      g.sort_order = idx;
    });

    setModifierGroups(newGroups);

    try {
      setReordering(true);
      const response = await fetch(
        `/api/modifiers/groups/reorder`,
        addCSRFToken({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groups: newGroups.map(g => ({ id: g.id, sort_order: g.sort_order })),
          }),
        })
      );

      if (!response.ok) throw new Error("Failed to save order");
      dataCache.clear(session!.org_id, "modifier_groups");
      showToast("Order saved", "success");
    } catch (err) {
      console.error("Failed to save order:", err);
      showToast("Failed to save order", "error");
      fetchModifierGroups(true);
    } finally {
      setReordering(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#2d2d2d] flex flex-col overflow-hidden">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      
      {/* Loading Overlay */}
      {modifierGroupsLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#3d3d3d] rounded-lg p-6 shadow-xl flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-penkey-orange animate-spin" />
            <p className="text-sm font-medium text-white">Loading modifier groups...</p>
          </div>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title="Modifier Groups"
        showBack={true}
        backHref="/items-hub"
        showHome={true}
        showMenu={true}
        session={session}
        rightActions={
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
        }
      />

      {/* Search Bar */}
      {searchOpen && (
        <div className="bg-[#3d3d3d] border-b border-gray-700 px-4 py-3">
          <input
            type="text"
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="w-full bg-[#2d2d2d] text-white border border-gray-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-penkey-orange"
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {filteredGroups.length > 0 ? (
          <div className="space-y-3 px-3 py-3">
            {filteredGroups.map((group, index) => {
              const isSelected = selectionMode && selectedIds.has(group.id);
              const isFirst = index === 0;
              const isLast = index === filteredGroups.length - 1;
              return (
                <div
                  key={group.id}
                  onPointerDown={() => {
                    setLongPressFired(false);
                    setWasLongPress(false);
                    const t = setTimeout(() => {
                      setLongPressFired(true);
                      setWasLongPress(true);
                      setSelectionMode(true);
                      setSelectedIds((prev) => new Set(prev).add(group.id));
                    }, 450);
                    setLongPressTimer(t);
                  }}
                  onPointerUp={() => {
                    if (longPressTimer) {
                      clearTimeout(longPressTimer);
                      setLongPressTimer(null);
                      // Only navigate if long press didn't fire
                      if (!longPressFired && !selectionMode) {
                        // Normal tap navigates to full edit page
                        hapticButtonPress();
                        router.push(`/modifiers/${group.id}`);
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
                      if (next.has(group.id)) next.delete(group.id); else next.add(group.id);
                      setSelectedIds(next);
                      if (next.size === 0) {
                        setSelectionMode(false);
                      }
                    }
                  }}
                  className="w-full bg-[#3d3d3d] hover:bg-[#4d4d4d] transition-colors p-4 flex items-center gap-3 text-left rounded-lg border border-gray-700"
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
                  {/* Content */}
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
                  
                  {/* Reorder buttons */}
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        hapticButtonPress();
                        moveGroup(group.id, 'up');
                      }}
                      disabled={isFirst || reordering}
                      className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move up"
                    >
                      <ChevronUp className="h-5 w-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        hapticButtonPress();
                        moveGroup(group.id, 'down');
                      }}
                      disabled={isLast || reordering}
                      className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move down"
                    >
                      <ChevronDown className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 px-4">
            <Package className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">
              {searchQuery ? "No groups found" : "No modifier groups yet"}
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
              selectedIds.size === filteredGroups.length ? "bg-penkey-orange border-penkey-orange" : "border-gray-500"
            }`}
            onClick={() => {
              if (selectedIds.size === filteredGroups.length) {
                setSelectedIds(new Set());
              } else {
                setSelectedIds(new Set(filteredGroups.map(group => group.id)));
              }
            }}
          >
            {selectedIds.size === filteredGroups.length && (
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            )}
          </div>
          <span className="text-sm text-white mr-auto">{selectedIds.size} selected</span>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => {
              setAssignBulkOpen(true);
            }}
          >
            Link to items
          </Button>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={async () => {
              if (!session) return;
              const ids = Array.from(selectedIds);
              if (!confirm(`Delete ${ids.length} modifier group${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
              
              try {
                if (!session) {
                  showToast('Session expired. Please log in again.', 'error');
                  return;
                }
                
                const results = await Promise.all(
                  ids.map((id) =>
                    fetch(`/api/modifiers/groups/${id}`, {
                      method: 'DELETE',
                      credentials: 'same-origin', // Include cookies
                    })
                  )
                );
                
                // Check for errors
                for (const res of results) {
                  if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.error || 'Failed to delete modifier group');
                  }
                }
                
                // Clear caches
                invalidateAllModifiers(session.org_id);
                dataCache.clear(session.org_id, "modifier_groups");
                
                showToast(`${ids.length} modifier group${ids.length === 1 ? '' : 's'} deleted successfully`, "success");
                fetchModifierGroups(true);
                setSelectionMode(false);
                setSelectedIds(new Set());
              } catch (error: any) {
                console.error("Failed to delete modifier groups:", error);
                showToast(`Failed to delete modifier groups: ${error.message}`, "error");
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
          <QuickAddModifierDialog
            open={addDialogOpen}
            onClose={() => setAddDialogOpen(false)}
            orgId={session.org_id}
            onSuccess={() => {
              // Invalidate all modifier caches
              invalidateAllModifiers(session.org_id);
              dataCache.clear(session.org_id, "modifier_groups");
              // Force refresh from API
              fetchModifierGroups(true);
              setAddDialogOpen(false);
            }}
          />
          
          {/* Assign to items dialog (opened from within edit page or future actions) */}
          {false && (
            <AssignModifierDialog
              open={assignDialogOpen}
              onClose={() => setAssignDialogOpen(false)}
              modifierGroup={{} as any}
              orgId={"" as any}
              onSuccess={() => setAssignDialogOpen(false)}
            />
          )}

          {/* Bulk assign dialog for multiple selected groups */}
          {assignBulkOpen && session && (
            <AssignModifierDialog
              open={assignBulkOpen}
              onClose={() => setAssignBulkOpen(false)}
              modifierGroup={{ id: 'bulk', name: `${selectedIds.size} groups` } as any}
              modifierGroupIds={Array.from(selectedIds)}
              orgId={session.org_id}
              onSuccess={() => {
                setAssignBulkOpen(false);
                // No cache change needed for items; assignments handled server-side
                setSelectionMode(false);
                setSelectedIds(new Set());
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
