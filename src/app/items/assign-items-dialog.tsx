"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from "@penkey/ui";
import { createSupabaseClient } from "@penkey/database";
import { hapticSuccess, hapticButtonPress } from "@/lib/utils/haptics";
import { Loader2, Check } from "lucide-react";

interface AssignItemsDialogProps {
  open: boolean;
  onClose: () => void;
  category: any;
  items: any[];
  onSuccess: () => void;
}

export function AssignItemsDialog({
  open,
  onClose,
  category,
  items,
  onSuccess,
}: AssignItemsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (category && items) {
      // Pre-select items that already belong to this category
      const categoryItems = items
        .filter(item => item.category_id === category.id)
        .map(item => item.id);
      setSelectedItems(new Set(categoryItems));
    }
  }, [category, items]);

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
    setLoading(true);
    hapticButtonPress();

    try {
      const supabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Update all items - set category_id for selected, null for unselected
      const updates = items.map(item => {
        const shouldBeInCategory = selectedItems.has(item.id);
        const isInCategory = item.category_id === category.id;
        
        if (shouldBeInCategory && !isInCategory) {
          // Add to category
          return supabase
            .from("items")
            .update({ category_id: category.id })
            .eq("id", item.id);
        } else if (!shouldBeInCategory && isInCategory) {
          // Remove from category
          return supabase
            .from("items")
            .update({ category_id: null })
            .eq("id", item.id);
        }
        return null;
      }).filter(Boolean);

      await Promise.all(updates);

      hapticSuccess();
      onSuccess();
    } catch (error) {
      console.error("Failed to assign items:", error);
      alert("Failed to assign items");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-[#3d3d3d] max-h-[90vh] overflow-y-auto scrollbar-hide">
        <DialogHeader>
          <DialogTitle className="text-xl text-white">
            Assign Items to {category?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 py-4">
          {items.length > 0 ? (
            items.map((item) => {
              const isSelected = selectedItems.has(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                    isSelected
                      ? "border-penkey-orange bg-orange-900/20"
                      : "border-gray-600 hover:border-gray-500"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-white text-sm">{item.name}</h4>
                      {item.categories && item.category_id !== category.id && (
                        <p className="text-xs text-gray-400">
                          Currently in: {item.categories.name}
                        </p>
                      )}
                    </div>
                    <div
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                        isSelected
                          ? "bg-penkey-orange border-penkey-orange"
                          : "border-gray-500"
                      }`}
                    >
                      {isSelected && <Check className="h-4 w-4 text-white" />}
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <p className="text-center text-gray-400 py-8">No items available</p>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 bg-penkey-orange hover:bg-penkey-orange/90"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              `Save (${selectedItems.size} items)`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
