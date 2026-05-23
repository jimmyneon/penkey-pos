"use client";

import { useState, useEffect } from "react";
import { X, Check, Loader2, Search } from "lucide-react";
import { hapticSuccess, hapticButtonPress } from "@/lib/utils/haptics";
import { dataCache } from "@/lib/services/data-cache";
import { setModifierGroupItems } from "@/lib/services/modifier-assignment";

interface Item {
  id: string;
  name: string;
  base_price: number;
  category_id: string | null;
  categories: {
    name: string;
    color: string | null;
  } | null;
}

interface ModifierGroup {
  id: string;
  name: string;
}

interface AssignModifierDialogProps {
  open: boolean;
  onClose: () => void;
  modifierGroup: ModifierGroup;
  // Optional: when provided, assign these multiple modifier group IDs in bulk
  modifierGroupIds?: string[];
  orgId: string;
  onSuccess: () => void;
}

export function AssignModifierDialog({
  open,
  onClose,
  modifierGroup,
  modifierGroupIds,
  orgId,
  onSuccess,
}: AssignModifierDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (open && orgId) {
      fetchItems();
      fetchAssignedItems();
    }
  }, [open, orgId, modifierGroup.id]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      
      // Try cache first
      const cached = dataCache.get<Item[]>(orgId, "items");
      if (cached) {
        setItems(cached);
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/items?org_id=${orgId}`);
      if (!response.ok) throw new Error("Failed to fetch items");
      
      const data = await response.json();
      dataCache.set(orgId, "items", data);
      setItems(data);
    } catch (error) {
      console.error("Failed to fetch items:", error);
    } finally {
      setLoading(false);
    }
  };

  // Track the original set so we can pass previousItemIds for proper cache refresh
  const [originalAssigned, setOriginalAssigned] = useState<Set<string>>(new Set());

  const fetchAssignedItems = async () => {
    try {
      const response = await fetch(`/api/items/modifiers?modifier_group_id=${modifierGroup.id}`);
      if (!response.ok) throw new Error("Failed to fetch assigned items");
      
      const data = await response.json();
      const assignedIds: string[] = data.map((item: any) => item.item_id);
      setSelectedItems(new Set(assignedIds));
      setOriginalAssigned(new Set(assignedIds));
    } catch (error) {
      console.error("Failed to fetch assigned items:", error);
    }
  };

  const toggleItem = (itemId: string) => {
    hapticButtonPress();
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleSave = async () => {
    setSaving(true);
    hapticButtonPress();

    try {
      const groupIds = modifierGroupIds && modifierGroupIds.length > 0
        ? modifierGroupIds
        : [modifierGroup.id];

      const desired = Array.from(selectedItems);
      const previous = Array.from(originalAssigned);

      // Set-based reconcile: replaces the full set of items for each group.
      // Falls back to outbox on network/server failure (never silently lost).
      const results = await Promise.all(
        groupIds.map((gid) =>
          setModifierGroupItems({
            modifierGroupId: gid,
            itemIds: desired,
            orgId,
            previousItemIds: previous,
          })
        )
      );

      const anyFailed = results.some((r) => !r.ok && !r.queued);
      const anyQueued = results.some((r) => r.queued);

      if (anyFailed) {
        throw new Error(results.find((r) => !r.ok && !r.queued)?.error || "Failed");
      }

      if (anyQueued) {
        // Surface a soft notice without blocking the UX
        console.log("[AssignModifierDialog] Assignment queued for offline sync");
      }

      hapticSuccess();
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to assign modifiers:", error);
      alert("Failed to assign modifiers");
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#3d3d3d] rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">
              {modifierGroupIds && modifierGroupIds.length > 1
                ? `Assign ${modifierGroupIds.length} groups to Items`
                : "Assign to Items"}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            {modifierGroupIds && modifierGroupIds.length > 1 ? (
              <>
                Select items to add <span className="text-white font-medium">{modifierGroupIds.length}</span> modifier groups
              </>
            ) : (
              <>
                Select items to add <span className="text-white font-medium">{modifierGroup.name}</span> modifier
              </>
            )}
          </p>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#2d2d2d] text-white border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-penkey-orange"
            />
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-penkey-orange animate-spin" />
            </div>
          ) : filteredItems.length > 0 ? (
            <div className="divide-y divide-gray-700">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className="w-full p-4 flex items-center gap-3 hover:bg-[#4d4d4d] transition-colors text-left"
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedItems.has(item.id)
                        ? "bg-penkey-orange border-penkey-orange"
                        : "border-gray-500"
                    }`}
                  >
                    {selectedItems.has(item.id) && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm">{item.name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>£{(item.base_price || 0).toFixed(2)}</span>
                      {item.categories?.name && (
                        <>
                          <span>•</span>
                          <span>{item.categories.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              {searchQuery ? "No items found" : "No items available"}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-penkey-orange hover:bg-orange-600 text-white font-semibold py-3 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              `Assign (${selectedItems.size})`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
