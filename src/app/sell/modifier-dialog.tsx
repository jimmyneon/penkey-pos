"use client";

import { useState, useEffect, useRef } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Badge } from "@penkey/ui";
import { formatCurrency } from "@penkey/ui";
import { Check, Plus, Minus } from "lucide-react";
import { createSupabaseClient } from "@/lib/database";
import { hapticButtonPress } from "@/lib/utils/haptics";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { getItemModifiersFromCache } from "@/lib/services/modifier-cache";
import { getByKey } from "@/lib/idb/db";
import { modifierRAMCache } from "@/lib/services/modifier-ram-cache";

// Request deduplication cache to prevent duplicate API calls
// Cleared after 5s so stale promises don't block future loads
const modifierRequestCache = new Map<string, Promise<any[]>>();
function cacheRequest(itemId: string, promise: Promise<any[]>): Promise<any[]> {
  modifierRequestCache.set(itemId, promise);
  promise.finally(() => setTimeout(() => modifierRequestCache.delete(itemId), 5000));
  return promise;
}

interface ModifierOption {
  id: string;
  name: string;
  price_adjustment: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  selection_type: string;
  min_selections: number;
  max_selections: number | null;
  sort_order?: number;
  modifier_options: ModifierOption[];
}

interface ModifierDialogProps {
  open: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
  gridSize?: 2 | 3 | 4 | 5 | 6;
  onConfirm: (modifiers: Array<{ id: string; name: string; price_adjustment: number }>) => void;
  triggerAnimation?: (itemName: string, event: React.MouseEvent) => void;
}

export function ModifierDialog({
  open,
  onClose,
  itemId,
  itemName,
  gridSize = 3,
  onConfirm,
  triggerAnimation,
}: ModifierDialogProps) {
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  // Changed to track quantities: { groupId: { optionId: quantity } }
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [swipeState, setSwipeState] = useState<{ optionId: string; offset: number } | null>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isSwiping = useRef<boolean>(false);

  // Use scroll lock hook to manage scroll state
  useScrollLock(open);

  useEffect(() => {
    if (open) {
      loadModifiers();
    }
  }, [open, itemId]);

  const loadModifiers = async () => {
    try {
      // 1) Try RAM cache first (fastest - <1ms) — no loading state needed
      const ramGroups = modifierRAMCache.get(itemId);
      if (ramGroups) {
        console.log('[ModifierDialog] ⚡ RAM cache hit for item:', itemId);
        setModifierGroups(ramGroups);
        setSelectedModifiersDefaults(ramGroups);
        setLoading(false);
        return;
      }

      setLoading(true);

      // Get org_id from session
      const sessionData = sessionStorage.getItem("pos_session");
      const orgId = sessionData ? JSON.parse(sessionData).org_id : null;

      if (!orgId) {
        console.error('[ModifierDialog] No org_id found in session');
        setModifierGroups([]);
        return;
      }

      // 2) Check if request already in flight (deduplication)
      if (modifierRequestCache.has(itemId)) {
        console.log('[ModifierDialog] Reusing in-flight request for item:', itemId);
        const cachedGroups = await modifierRequestCache.get(itemId)!;
        setModifierGroups(cachedGroups);
        setSelectedModifiersDefaults(cachedGroups);
        setLoading(false);
        return;
      }

      // 3) Load from IndexedDB and cache in RAM
      const loadPromise = (async () => {
        try {
          const row: any = await getByKey('item_modifier_groups', itemId as any);
          
          if (!row) {
            console.warn('[ModifierDialog] Item not found in modifier cache:', itemId);
            return [];
          }
          
          if (row.groups?.length) {
            // Filter inactive options and sort by sort_order
            const filteredGroups: ModifierGroup[] = row.groups
              .filter((g: any) => g && g.modifier_options?.length > 0)
              .map((g: any) => ({
                ...g,
                // Sort modifier options by sort_order (already set in database)
                modifier_options: g.modifier_options
                  .filter((opt: any) => opt.is_active !== false)
                  .slice()
                  .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
              })) as ModifierGroup[];

            // Groups are already sorted by the API (item_modifiers.sort_order, then modifier_groups.sort_order)
            // But sort again just to be safe in case cache is stale
            const orderedGroups = filteredGroups
              .slice()
              .sort((a: any, b: any) => {
                // First by item_sort_order (from item_modifiers table)
                const itemSort = (a.item_sort_order ?? 0) - (b.item_sort_order ?? 0);
                if (itemSort !== 0) return itemSort;
                // Then by group sort_order (from modifier_groups table)
                return (a.sort_order ?? 0) - (b.sort_order ?? 0);
              });
            
            console.log('[ModifierDialog] Sorted groups:', orderedGroups.map((g: any) => ({
              name: g.name,
              item_sort_order: g.item_sort_order,
              sort_order: g.sort_order,
              selection_type: g.selection_type,
              min_selections: g.min_selections
            })));
            
            // Cache in RAM for instant access next time
            modifierRAMCache.set(itemId, orderedGroups);
            return orderedGroups;
          }
          
          console.log('[ModifierDialog] Item has no modifiers:', itemId);
          return [];
        } catch (err) {
          console.error('[ModifierDialog] Error loading modifiers:', err);
          return [];
        }
      })();
      
      // Cache the promise to deduplicate requests (auto-clears after 5s)
      cacheRequest(itemId, loadPromise);
      const loadedGroups = await loadPromise;
      
      setModifierGroups(loadedGroups);
      setSelectedModifiersDefaults(loadedGroups);
    } catch (err) {
      console.error("Failed to load modifiers:", err);
    } finally {
      setLoading(false);
    }
  };

  const setSelectedModifiersDefaults = (groups: ModifierGroup[]) => {
    const defaults: Record<string, Record<string, number>> = {};
    groups.forEach((group: ModifierGroup) => {
      console.log(`[ModifierDialog] Group: ${group.name}, Type: ${group.selection_type}, Min: ${group.min_selections}, Max: ${group.max_selections}`);
      const defaultOptions = group.modifier_options.filter((opt) => opt.is_default);
      if (defaultOptions.length > 0) {
        defaults[group.id] = {};
        defaultOptions.forEach((opt) => {
          defaults[group.id][opt.id] = 1;
        });
      } else if (group.selection_type === 'required' || group.min_selections > 0) {
        // For required groups with no default set, auto-select the first option
        if (group.modifier_options.length > 0) {
          defaults[group.id] = {};
          defaults[group.id][group.modifier_options[0].id] = 1;
          console.log(`[ModifierDialog] Auto-selected first option for required group: ${group.name}`);
        }
      }
    });
    setSelectedModifiers(defaults);
  };

  const handleOptionTap = (groupId: string, optionId: string, group: ModifierGroup) => {
    setSelectedModifiers((prev) => {
      const groupSelections = prev[groupId] || {};
      const currentQty = groupSelections[optionId] || 0;
      const totalSelected = Object.values(groupSelections).reduce((sum, qty) => sum + qty, 0);
      const maxAllowed = (group.max_selections == null || group.max_selections === undefined)
        ? Infinity
        : Math.max(0, group.max_selections);

      // If max is 1, behave as single-select toggle
      if (maxAllowed === 1) {
        if (currentQty > 0) {
          // toggle off
          const newGroup: Record<string, number> = { ...groupSelections };
          delete newGroup[optionId];
          return { ...prev, [groupId]: newGroup };
        } else {
          // select this, clear others
          return { ...prev, [groupId]: { [optionId]: 1 } };
        }
      }

      // Multi-select: increment up to 5, but respect maxAllowed cap
      const nextQty = currentQty >= 5 ? 0 : currentQty + 1;

      const newGroupSelections: Record<string, number> = { ...groupSelections };
      if (nextQty === 0) {
        delete newGroupSelections[optionId];
        return { ...prev, [groupId]: newGroupSelections };
      }

      // If adding would exceed maxAllowed, do not apply the increment
      const adding = nextQty - currentQty; // either 1 if we incremented, else negative/0
      if (adding > 0 && totalSelected >= maxAllowed && maxAllowed !== Infinity) {
        return prev; // ignore increment beyond max
      }

      newGroupSelections[optionId] = nextQty;
      return { ...prev, [groupId]: newGroupSelections };
    });
  };

  const unmetRequirements = () => {
    const unmet: Array<{ groupId: string; groupName: string; needed: number; selected: number }> = [];
    modifierGroups.forEach((group) => {
      const groupSelections = selectedModifiers[group.id] || {};
      const totalSelected = Object.values(groupSelections).reduce((sum, qty) => sum + qty, 0);
      
      console.log(`[ModifierDialog] Checking ${group.name}: type=${group.selection_type}, min=${group.min_selections}, selected=${totalSelected}`);
      
      if (group.selection_type === "required") {
        const min = Math.max(1, group.min_selections || 1);
        if (totalSelected < min) {
          console.log(`[ModifierDialog] UNMET: ${group.name} needs ${min}, has ${totalSelected}`);
          unmet.push({ groupId: group.id, groupName: group.name, needed: min, selected: totalSelected });
        }
      } else if (group.min_selections && group.min_selections > 0) {
        if (totalSelected < group.min_selections) {
          console.log(`[ModifierDialog] UNMET: ${group.name} needs ${group.min_selections}, has ${totalSelected}`);
          unmet.push({ groupId: group.id, groupName: group.name, needed: group.min_selections, selected: totalSelected });
        }
      }
    });
    return unmet;
  };

  const canConfirm = () => unmetRequirements().length === 0;

  const handleConfirm = (event: React.MouseEvent) => {
    if (!canConfirm()) {
      // Do nothing; button should generally be disabled, but guard anyway
      return;
    }
    const allSelectedModifiers: Array<{ id: string; name: string; price_adjustment: number }> = [];

    modifierGroups.forEach((group) => {
      const groupSelections = selectedModifiers[group.id] || {};
      Object.entries(groupSelections).forEach(([optionId, quantity]) => {
        const option = group.modifier_options.find((opt) => opt.id === optionId);
        if (option && quantity > 0) {
          // Add the modifier multiple times based on quantity
          for (let i = 0; i < quantity; i++) {
            allSelectedModifiers.push({
              id: option.id,
              name: option.name,
              price_adjustment: option.price_adjustment,
            });
          }
        }
      });
    });

    // Trigger flying animation if provided
    if (triggerAnimation) {
      triggerAnimation(itemName, event);
    }

    onConfirm(allSelectedModifiers);
    onClose();
  };

  const getTotalAdjustment = () => {
    let total = 0;
    modifierGroups.forEach((group) => {
      const groupSelections = selectedModifiers[group.id] || {};
      Object.entries(groupSelections).forEach(([optionId, quantity]) => {
        const option = group.modifier_options.find((opt) => opt.id === optionId);
        if (option && quantity > 0) {
          total += option.price_adjustment * quantity;
        }
      });
    });
    return total;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] bg-[#3d3d3d] text-white border-gray-700 p-0 flex flex-col overflow-hidden">
        {/* Fixed Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-700 flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="text-xl text-white">Customize</DialogTitle>
            <DialogDescription className="text-sm text-gray-400">{itemName}</DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-6">
          {loading ? (
            <div className="py-8 text-center text-gray-400">Loading options...</div>
          ) : modifierGroups.length === 0 ? (
            <div className="py-8 text-center text-gray-400">No customizations available</div>
          ) : (
            <div className="space-y-6 py-4">
              {modifierGroups.map((group) => {
                const groupSelections = selectedModifiers[group.id] || {};
                const totalSelected = Object.values(groupSelections).reduce((sum, qty) => sum + qty, 0);
                const minRequired = group.selection_type === 'required' ? Math.max(1, group.min_selections || 1) : (group.min_selections || 0);
                const isUnmet = totalSelected < minRequired;
                return (
                <div key={group.id}>
                  <div className="mb-3">
                    <h3 className="font-semibold text-white text-lg flex items-center gap-2">
                      {group.name}
                      {group.selection_type === 'required' && (
                        <span className="text-penkey-orange text-xs font-semibold bg-orange-500/10 border border-orange-700 px-2 py-0.5 rounded">
                          Required{minRequired > 1 ? ` · Min ${minRequired}` : ''}
                        </span>
                      )}
                      {group.selection_type !== 'required' && group.min_selections > 0 && (
                        <span className="text-gray-300 text-xs font-semibold bg-gray-500/10 border border-gray-600 px-2 py-0.5 rounded">
                          Min {group.min_selections}
                        </span>
                      )}
                      {group.max_selections != null && (
                        <span className="text-gray-300 text-xs font-semibold bg-gray-500/10 border border-gray-600 px-2 py-0.5 rounded">
                          Max {group.max_selections}
                        </span>
                      )}
                    </h3>
                    {isUnmet && minRequired > 0 && (
                      <p className="mt-1 text-xs text-red-400">Select at least {minRequired} option{minRequired > 1 ? 's' : ''}.</p>
                    )}
                  </div>

                  <div className={`grid gap-2 md:gap-3 ${
                    gridSize === 2 ? 'grid-cols-2' :
                    gridSize === 3 ? 'grid-cols-3' :
                    gridSize === 4 ? 'grid-cols-4' :
                    gridSize === 5 ? 'grid-cols-5' :
                    'grid-cols-6'
                  }`}>
                    {group.modifier_options.map((option) => {
                      const quantity = (selectedModifiers[group.id] || {})[option.id] || 0;
                      const isSelected = quantity > 0;
                      const isSwipingThis = swipeState?.optionId === option.id;
                      const swipeOffset = isSwipingThis ? swipeState.offset : 0;
                      const showReset = swipeOffset > 30;
                      
                      return (
                        <div
                          key={option.id}
                          className="relative overflow-hidden rounded-lg aspect-square"
                        >
                          {/* Red Reset Background */}
                          <div className="absolute inset-0 bg-red-600 flex items-center justify-center">
                            <span className="text-white font-bold text-lg">RESET</span>
                          </div>
                          
                          {/* Swipeable Button */}
                          <button
                            onClick={() => {
                              if (!isSwiping.current) {
                                hapticButtonPress();
                                handleOptionTap(group.id, option.id, group);
                              }
                            }}
                            onTouchStart={(e) => {
                              // Only allow swipe if quantity > 0
                              if (quantity > 0) {
                                touchStartX.current = e.touches[0].clientX;
                                touchStartY.current = e.touches[0].clientY;
                                isSwiping.current = false;
                              }
                            }}
                            onTouchMove={(e) => {
                              // Only allow swipe if quantity > 0
                              if (quantity === 0) return;
                              
                              const deltaX = e.touches[0].clientX - touchStartX.current;
                              const deltaY = e.touches[0].clientY - touchStartY.current;
                              
                              // Only swipe if horizontal movement is dominant
                              if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 5) {
                                isSwiping.current = true;
                                e.preventDefault();
                                
                                // Only allow right swipe (positive deltaX)
                                if (deltaX > 0) {
                                  setSwipeState({ optionId: option.id, offset: Math.min(deltaX, 120) });
                                }
                              }
                            }}
                            onTouchEnd={(e) => {
                              if (swipeState?.optionId === option.id) {
                                if (swipeState.offset > 80) {
                                  // Reset to 0
                                  hapticButtonPress();
                                  setSelectedModifiers((prev) => {
                                    const newState = { ...prev };
                                    if (newState[group.id]) {
                                      const newGroup = { ...newState[group.id] };
                                      delete newGroup[option.id];
                                      newState[group.id] = newGroup;
                                    }
                                    return newState;
                                  });
                                }
                                setSwipeState(null);
                              }
                              setTimeout(() => {
                                isSwiping.current = false;
                              }, 100);
                            }}
                            style={{
                              transform: `translateX(${swipeOffset}px)`,
                              transition: swipeState?.optionId === option.id ? 'none' : 'transform 0.3s ease-out',
                            }}
                            className={`absolute inset-0 rounded-lg flex flex-col items-center justify-center ${
                              gridSize >= 5 ? 'p-2' : gridSize === 4 ? 'p-2.5' : 'p-3'
                            } ${
                              isSelected
                                ? "bg-penkey-orange"
                                : "bg-[#5d5d5d] hover:bg-[#6d6d6d]"
                            }`}
                          >
                            <div className="flex flex-col items-center gap-2 text-center">
                              <span className={`font-bold text-white leading-tight ${
                                gridSize >= 5 ? 'text-xs' : gridSize === 4 ? 'text-sm' : 'text-base'
                              }`}>
                                {option.name}
                              </span>
                              <span className={`font-bold text-white ${
                                gridSize >= 5 ? 'text-sm' : gridSize === 4 ? 'text-lg' : 'text-xl'
                              }`}>
                                {option.price_adjustment === 0 
                                  ? "Free" 
                                  : `${option.price_adjustment > 0 ? "+" : ""}${formatCurrency(option.price_adjustment)}`
                                }
                              </span>
                            </div>
                            {isSelected && (
                              <div className={`absolute top-2 right-2 bg-white text-penkey-orange rounded-full flex items-center justify-center font-bold ${
                                gridSize >= 5 ? 'w-6 h-6 text-xs' : 'w-7 h-7 text-sm'
                              }`}>
                                {quantity}
                              </div>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );})}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 p-4 flex items-center justify-between gap-3">
          <div className="text-white font-semibold">
            Total: {formatCurrency(getTotalAdjustment())}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className={`text-white ${canConfirm() ? 'bg-penkey-orange hover:bg-penkey-orange/90' : 'bg-gray-600 cursor-not-allowed'}`}
              onClick={(e) => handleConfirm(e)}
              disabled={!canConfirm()}
            >
              Add
            </Button>
          </div>
        </div>
        {/* Global unmet message */}
        {!canConfirm() && (
          <div className="px-6 pb-4 text-xs text-red-400">You must choose required modifiers before continuing.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
