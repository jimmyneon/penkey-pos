"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@penkey/ui";
import { ArrowLeft, Plus, Trash2, GripVertical, Loader2, Edit } from "lucide-react";
import { hapticButtonPress, hapticDelete } from "@/lib/utils/haptics";
import { dataCache } from "@/lib/services/data-cache";
import { useToast } from "@/lib/hooks/use-toast";
import { ToastContainer } from "@/components/toast-container";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { addCSRFToken } from "@/lib/utils/csrf-client";
import { modifierRAMCache } from "@/lib/services/modifier-ram-cache";
import { onSyncComplete } from "@/lib/services/unified-sync";

interface Session {
  employee: { id: string; name: string; role: string };
  register: { id: string; name: string; store_name: string };
  org_id: string;
}

interface ModifierOption {
  id: string;
  name: string;
  price_adjustment: number;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  selection_type: string;
  min_selections: number;
  max_selections: number | null;
  modifier_options: ModifierOption[];
}

export default function EditModifierGroupPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;
  const { toasts, showToast, dismissToast } = useToast();
  
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [group, setGroup] = useState<ModifierGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [selectionType, setSelectionType] = useState("optional");
  const [minSelections, setMinSelections] = useState(0);
  const [maxSelections, setMaxSelections] = useState<number | null>(null);
  const [position, setPosition] = useState<number>(1);
  const [groupCount, setGroupCount] = useState<number>(1);
  const [originalPosition, setOriginalPosition] = useState<number>(1);
  const [options, setOptions] = useState<ModifierOption[]>([]);
  const [addOptionName, setAddOptionName] = useState("");
  const [addOptionPrice, setAddOptionPrice] = useState("");
  const [showAddOption, setShowAddOption] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [deleteOptionId, setDeleteOptionId] = useState<string | null>(null);
  const [showDeleteGroupConfirm, setShowDeleteGroupConfirm] = useState(false);
  const [editingOption, setEditingOption] = useState<ModifierOption | null>(null);
  const [editOptionName, setEditOptionName] = useState("");
  const [editOptionPrice, setEditOptionPrice] = useState("");

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
    if (session?.org_id && groupId) {
      fetchGroup();
    }
  }, [session?.org_id, groupId]);

  // Listen for sync events and reload data
  useEffect(() => {
    if (!session?.org_id) return;
    
    const unsubscribe = onSyncComplete(() => {
      console.log('[EditModifierGroup] Sync completed, reloading group data');
      fetchGroup();
    });
    
    return () => {
      unsubscribe();
    };
  }, [session?.org_id, groupId]);

  const fetchGroup = async () => {
    try {
      setLoading(true);
      // Add cache-busting timestamp to prevent stale responses
      const response = await fetch(`/api/modifiers/groups?org_id=${session?.org_id}&_t=${Date.now()}`);
      if (!response.ok) throw new Error("Failed to fetch groups");
      
      const groups = await response.json();
      // Ensure groups are ordered by sort_order
      const ordered = (groups as ModifierGroup[]).slice().sort((a, b) => (a as any).sort_order - (b as any).sort_order);
      const foundGroup = ordered.find((g: ModifierGroup) => g.id === groupId);
      
      if (!foundGroup) {
        throw new Error("Group not found");
      }

      setGroup(foundGroup);
      setGroupName(foundGroup.name);
      setSelectionType(foundGroup.selection_type);
      setMinSelections(foundGroup.min_selections);
      setMaxSelections(foundGroup.max_selections);
      setOptions(foundGroup.modifier_options.sort((a: ModifierOption, b: ModifierOption) => a.sort_order - b.sort_order));
      // Position setup
      const idx = ordered.findIndex((g) => g.id === groupId);
      const pos = idx >= 0 ? idx + 1 : 1;
      setPosition(pos);
      setOriginalPosition(pos);
      setGroupCount(ordered.length);
    } catch (err) {
      console.error("Failed to load group:", err);
      showToast("Failed to load modifier group", "error");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGroup = async () => {
    try {
      setSaving(true);
      
      const response = await fetch(`/api/modifiers/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName,
          selection_type: selectionType,
          min_selections: minSelections,
          max_selections: maxSelections,
        }),
      });

      if (!response.ok) throw new Error("Failed to update group");
      
      // If position changed, compute reorder and persist
      if (position !== originalPosition) {
        // Fetch fresh list of groups to ensure we have full ordering
        const listRes = await fetch(`/api/modifiers/groups?org_id=${session?.org_id}`);
        if (!listRes.ok) throw new Error("Failed to fetch groups for reordering");
        const allGroups: ModifierGroup[] = await listRes.json();
        const ordered = allGroups.slice().sort((a: any, b: any) => a.sort_order - b.sort_order);

        // Remove current group from list
        const without = ordered.filter((g) => g.id !== groupId);
        // Clamp position to range 1..length+1
        const targetIndex = Math.max(0, Math.min(position - 1, without.length));
        // Insert at new position (others shift down automatically)
        without.splice(targetIndex, 0, ordered.find((g) => g.id === groupId)!);
        // Reassign sort_order
        const payload = without.map((g, idx) => ({ id: g.id, sort_order: idx }));

        const reorderRes = await fetch(
          `/api/modifiers/groups/reorder`,
          addCSRFToken({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ groups: payload }),
          })
        );
        if (!reorderRes.ok) throw new Error("Failed to save new position");
        setOriginalPosition(position);
      }

      // Clear caches (IDB + RAM) so sell popup reflects changes immediately
      dataCache.clear(session!.org_id, "modifier_groups");
      dataCache.clear(session!.org_id, "item_modifier_groups"); // Clear item-specific modifier cache
      modifierRAMCache.clear();
      
      showToast("Group updated successfully!", "success");
    } catch (err) {
      console.error("Failed to save group:", err);
      showToast("Failed to save changes", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAddOption = async () => {
    if (!addOptionName.trim()) {
      showToast("Please enter option name", "error");
      return;
    }

    const price = parseFloat(addOptionPrice) || 0;

    try {
      setSaving(true);
      
      console.log("[Add Option] Sending:", {
        group_id: groupId,
        name: addOptionName,
        price_adjustment: price,
        sort_order: options.length,
      });
      
      const response = await fetch(`/api/modifiers/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_id: groupId,
          name: addOptionName,
          price_adjustment: price,
          sort_order: options.length,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Add Option] Error response:", errorData);
        throw new Error(errorData.error || "Failed to add option");
      }
      
      const newOption = await response.json();
      console.log("[Add Option] Success:", newOption);
      
      setOptions([...options, newOption]);
      setAddOptionName("");
      setAddOptionPrice("");
      setShowAddOption(false);
      
      // Clear cache
      dataCache.clear(session!.org_id, "modifier_groups");
      dataCache.clear(session!.org_id, "item_modifier_groups");
      modifierRAMCache.clear();
      
      hapticButtonPress();
    } catch (err: any) {
      console.error("Failed to add option:", err);
      showToast(`Failed to add option: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEditOption = async () => {
    if (!editingOption || !editOptionName.trim()) {
      showToast("Please enter option name", "error");
      return;
    }

    const price = parseFloat(editOptionPrice) || 0;

    try {
      setSaving(true);
      
      console.log("[Edit Option] Sending:", {
        id: editingOption.id,
        name: editOptionName,
        price_adjustment: price,
      });
      
      const response = await fetch(
        `/api/modifiers/options/${editingOption.id}`,
        addCSRFToken({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editOptionName,
            price_adjustment: price,
          }),
        })
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Edit Option] Error response:", errorData);
        throw new Error(errorData.error || "Failed to update option");
      }
      
      console.log("[Edit Option] Success");
      
      // Update local state
      setOptions(options.map(opt => 
        opt.id === editingOption.id 
          ? { ...opt, name: editOptionName, price_adjustment: price }
          : opt
      ));
      
      setEditingOption(null);
      setEditOptionName("");
      setEditOptionPrice("");
      
      // Clear cache
      dataCache.clear(session!.org_id, "modifier_groups");
      dataCache.clear(session!.org_id, "item_modifier_groups");
      modifierRAMCache.clear();
      
      showToast("Option updated successfully!", "success");
      hapticButtonPress();
    } catch (err: any) {
      console.error("Failed to update option:", err);
      showToast(`Failed to update option: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOption = async (optionId: string) => {
    try {
      hapticDelete();
      setSaving(true);
      
      const response = await fetch(
        `/api/modifiers/options/${optionId}`,
        addCSRFToken({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: false }),
        })
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Delete Option] Error response:", errorData);
        throw new Error(errorData.error || "Failed to delete option");
      }
      
      console.log("[Delete Option] Success");
      
      // Remove from local state
      setOptions(options.filter(opt => opt.id !== optionId));
      
      // Clear cache
      dataCache.clear(session!.org_id, "modifier_groups");
      dataCache.clear(session!.org_id, "item_modifier_groups");
      modifierRAMCache.clear();
      
      hapticDelete();
      showToast("Option deleted successfully!", "success");
    } catch (err: any) {
      console.error("Failed to delete option:", err);
      showToast(`Failed to delete option: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefaultOption = async (optionId: string) => {
    try {
      setSaving(true);
      
      // Update all options in the group: set is_default to false for all, then true for selected
      const updatePromises = options.map(opt => 
        fetch(
          `/api/modifiers/options/${opt.id}`,
          addCSRFToken({
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_default: opt.id === optionId }),
          })
        )
      );

      await Promise.all(updatePromises);
      
      // Update local state
      setOptions(options.map(opt => ({
        ...opt,
        is_default: opt.id === optionId
      })));
      
      // Clear cache
      dataCache.clear(session!.org_id, "modifier_groups");
      dataCache.clear(session!.org_id, "item_modifier_groups");
      modifierRAMCache.clear();
      
      hapticButtonPress();
      showToast("Default option updated!", "success");
    } catch (err: any) {
      console.error("Failed to set default option:", err);
      showToast(`Failed to set default option: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    setDraggedIndex(index);
    setTouchStartY(e.touches[0].clientY);
    hapticButtonPress();
  };

  const handleTouchMove = (e: React.TouchEvent, currentIndex: number) => {
    if (draggedIndex === null || touchStartY === null) return;
    
    const touchY = e.touches[0].clientY;
    const deltaY = touchY - touchStartY;
    
    // Determine if we should swap
    if (Math.abs(deltaY) > 60) { // 60px threshold
      let targetIndex = currentIndex;
      
      if (deltaY < 0 && currentIndex > 0) {
        // Moving up
        targetIndex = currentIndex - 1;
      } else if (deltaY > 0 && currentIndex < options.length - 1) {
        // Moving down
        targetIndex = currentIndex + 1;
      }
      
      if (targetIndex !== currentIndex) {
        const newOptions = [...options];
        const temp = newOptions[currentIndex];
        newOptions[currentIndex] = newOptions[targetIndex];
        newOptions[targetIndex] = temp;
        
        // Update sort orders
        newOptions.forEach((opt, idx) => {
          opt.sort_order = idx;
        });
        
        setOptions(newOptions);
        setDraggedIndex(targetIndex);
        setTouchStartY(touchY);
        hapticButtonPress();
      }
    }
  };

  const handleTouchEnd = () => {
    if (draggedIndex !== null) {
      saveSortOrder(options);
    }
    setDraggedIndex(null);
    setTouchStartY(null);
  };

  const saveSortOrder = async (newOptions: ModifierOption[]) => {
    try {
      console.log("[Reorder] Saving new order:", newOptions.map(opt => ({ id: opt.id, name: opt.name, sort_order: opt.sort_order })));
      
      const response = await fetch(
        `/api/modifiers/options/reorder`,
        addCSRFToken({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            options: newOptions.map(opt => ({ id: opt.id, sort_order: opt.sort_order })),
          }),
        })
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Reorder] Error:", errorData);
        throw new Error("Failed to save sort order");
      }
      
      console.log("[Reorder] Success");
      
      // Clear cache
      dataCache.clear(session!.org_id, "modifier_groups");
      dataCache.clear(session!.org_id, "item_modifier_groups");
      modifierRAMCache.clear();
    } catch (err) {
      console.error("Failed to save sort order:", err);
      showToast("Failed to save new order", "error");
    }
  };

  if (loading || !group) {
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
    <div className="h-screen w-screen bg-[#2d2d2d] flex flex-col overflow-hidden">
      {/* Loading Overlay */}
      {saving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#3d3d3d] rounded-lg p-6 shadow-xl flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-penkey-orange animate-spin" />
            <p className="text-sm font-medium text-white">Saving...</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-[#3d3d3d] text-white px-4 py-3 flex items-center justify-between border-b border-gray-700 flex-shrink-0">
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
        <h1 className="font-semibold text-lg">Edit Group</h1>
        <Button
          size="sm"
          onClick={handleSaveGroup}
          disabled={saving}
          className="bg-penkey-orange hover:bg-orange-600 text-white"
        >
          Save
        </Button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
        {/* Group Name */}
        <div className="bg-[#3d3d3d] border-b border-gray-700 p-4">
          <label className="block text-xs font-medium text-gray-400 mb-2">
            GROUP NAME
          </label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full bg-[#2d2d2d] text-white text-lg font-semibold border-none rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-penkey-orange"
            placeholder="e.g., Milk Options"
          />
        </div>

        {/* Modifier Rules */}
        <div className="bg-[#3d3d3d] border-b border-gray-700 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Modifier Type */}
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-400 mb-2">MODIFIER TYPE</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectionType("optional")}
                  className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                    selectionType === "optional"
                      ? "bg-penkey-orange border-penkey-orange text-white"
                      : "bg-[#2d2d2d] border-gray-600 text-gray-200 hover:bg-[#383838]"
                  }`}
                >
                  Optional
                </button>
                <button
                  type="button"
                  onClick={() => setSelectionType("required")}
                  className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                    selectionType === "required"
                      ? "bg-penkey-orange border-penkey-orange text-white"
                      : "bg-[#2d2d2d] border-gray-600 text-gray-200 hover:bg-[#383838]"
                  }`}
                >
                  Required
                </button>
              </div>
            </div>

            {/* Min selections */}
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-400 mb-2">MIN</label>
              <input
                type="number"
                min={0}
                value={minSelections}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setMinSelections(0);
                  } else {
                    const n = parseInt(val, 10);
                    if (!isNaN(n)) {
                      setMinSelections(Math.max(0, n));
                    }
                  }
                }}
                className="w-full bg-[#2d2d2d] text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-penkey-orange"
              />
            </div>

            {/* Max selections (empty = unlimited) */}
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-400 mb-2">MAX (empty = unlimited)</label>
              <input
                type="number"
                min={0}
                value={maxSelections === null ? "" : maxSelections}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    setMaxSelections(null);
                  } else {
                    const n = Math.max(0, parseInt(v, 10));
                    setMaxSelections(Number.isFinite(n) ? n : null);
                  }
                }}
                className="w-full bg-[#2d2d2d] text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-penkey-orange"
              />
            </div>

            {/* Position */}
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-400 mb-2">POSITION</label>
              <input
                type="number"
                min={1}
                max={groupCount}
                value={position}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setPosition(1);
                  } else {
                    const n = parseInt(val, 10);
                    if (!isNaN(n)) {
                      // Allow typing without immediate clamping
                      setPosition(n);
                    }
                  }
                }}
                onBlur={(e) => {
                  // Clamp on blur to ensure valid range
                  const n = parseInt(e.target.value || "1", 10);
                  const clamped = Math.max(1, Math.min(groupCount, isNaN(n) ? 1 : n));
                  setPosition(clamped);
                }}
                className="w-full bg-[#2d2d2d] text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-penkey-orange"
              />
              <p className="text-xs text-gray-400 mt-1">of {groupCount} (DB sort_order: {position - 1})</p>
            </div>
          </div>
        </div>

        {/* Options List */}
        <div className="bg-[#2d2d2d] pb-24">
          <div className="flex items-center justify-between px-4 py-3 bg-[#3d3d3d] border-b border-gray-700 sticky top-0 z-10">
            <h2 className="text-white font-semibold text-sm">OPTIONS ({options.length})</h2>
            <button
              onClick={() => {
                hapticButtonPress();
                setShowAddOption(!showAddOption);
              }}
              className="w-8 h-8 rounded-full bg-penkey-orange hover:bg-orange-600 flex items-center justify-center"
            >
              <Plus className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Add Option Form */}
          {showAddOption && (
            <div className="p-4 bg-[#3d3d3d] border-b border-gray-700 space-y-3">
              <input
                type="text"
                placeholder="Option name (e.g., Oat Milk)"
                value={addOptionName}
                onChange={(e) => setAddOptionName(e.target.value)}
                autoFocus
                className="w-full bg-[#2d2d2d] text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-penkey-orange"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Price adjustment (e.g., 0.50)"
                value={addOptionPrice}
                onChange={(e) => setAddOptionPrice(e.target.value)}
                className="w-full bg-[#2d2d2d] text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-penkey-orange"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddOption}
                  disabled={!addOptionName.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddOption(false);
                    setAddOptionName("");
                    setAddOptionPrice("");
                  }}
                  className="px-6 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Options */}
          <div className="divide-y divide-gray-700">
            {options.map((option, index) => (
              <div
                key={option.id}
                onTouchStart={(e) => handleTouchStart(e, index)}
                onTouchMove={(e) => handleTouchMove(e, index)}
                onTouchEnd={handleTouchEnd}
                className={`flex items-center gap-3 bg-[#3d3d3d] p-4 transition-all ${
                  draggedIndex === index ? "opacity-50 scale-105" : ""
                }`}
              >
                {/* Drag Handle */}
                <div className="flex items-center justify-center text-gray-500 cursor-grab active:cursor-grabbing">
                  <GripVertical className="h-6 w-6" />
                </div>

                {/* Default Option Radio (only for required modifiers) */}
                {selectionType === "required" && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetDefaultOption(option.id);
                    }}
                    className="flex items-center justify-center cursor-pointer"
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      option.is_default ? "bg-penkey-orange border-penkey-orange" : "border-gray-500"
                    }`}>
                      {option.is_default && (
                        <div className="w-3 h-3 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                )}

                {/* Option Info */}
                <div className="flex-1 min-w-0 pointer-events-none">
                  <p className="text-white font-medium">{option.name}</p>
                  <p className="text-sm text-penkey-orange font-semibold">
                    {option.price_adjustment > 0 ? `+£${option.price_adjustment.toFixed(2)}` : "Free"}
                  </p>
                </div>

                {/* Edit Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    hapticButtonPress();
                    setEditingOption(option);
                    setEditOptionName(option.name);
                    setEditOptionPrice(option.price_adjustment.toString());
                  }}
                  className="text-blue-400 hover:text-blue-300 p-3 active:scale-95 transition-transform z-10"
                >
                  <Edit className="h-6 w-6" />
                </button>

                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteOptionId(option.id);
                  }}
                  className="text-red-500 hover:text-red-400 p-3 active:scale-95 transition-transform z-10"
                >
                  <Trash2 className="h-6 w-6" />
                </button>
              </div>
            ))}

            {options.length === 0 && (
              <div className="text-center text-gray-400 py-12 px-4">
                <p className="mb-2">No options yet</p>
                <p className="text-sm">Tap the + button to add one</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Group Button - Sticky at Bottom */}
      <div className="p-4 bg-[#2d2d2d] border-t border-gray-700 flex-shrink-0">
        <button
          onClick={() => setShowDeleteGroupConfirm(true)}
          disabled={saving}
          className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold py-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-98"
        >
          <Trash2 className="h-5 w-5" />
          Delete Modifier Group
        </button>
      </div>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={deleteOptionId !== null}
        onClose={() => setDeleteOptionId(null)}
        title="Delete Option"
        message="Delete this option? This cannot be undone."
        variant="danger"
        confirmText="Delete"
        onConfirm={() => {
          if (deleteOptionId) {
            handleDeleteOption(deleteOptionId);
            setDeleteOptionId(null);
          }
        }}
      />

      <ConfirmDialog
        open={showDeleteGroupConfirm}
        onClose={() => setShowDeleteGroupConfirm(false)}
        title="Delete Modifier Group"
        message={`Delete "${groupName}" and all its options? This cannot be undone.`}
        variant="danger"
        confirmText="Delete"
        onConfirm={() => {
          handleDeleteGroup();
          setShowDeleteGroupConfirm(false);
        }}
      />

      {/* Edit Option Dialog */}
      {editingOption && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#3d3d3d] rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 space-y-4">
              <h3 className="text-white font-semibold text-lg">Edit Option</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    OPTION NAME
                  </label>
                  <input
                    type="text"
                    placeholder="Option name (e.g., Oat Milk)"
                    value={editOptionName}
                    onChange={(e) => setEditOptionName(e.target.value)}
                    autoFocus
                    className="w-full bg-[#2d2d2d] text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-penkey-orange"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    PRICE ADJUSTMENT (£)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={editOptionPrice}
                    onChange={(e) => setEditOptionPrice(e.target.value)}
                    className="w-full bg-[#2d2d2d] text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-penkey-orange"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setEditingOption(null);
                    setEditOptionName("");
                    setEditOptionPrice("");
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditOption}
                  disabled={!editOptionName.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
