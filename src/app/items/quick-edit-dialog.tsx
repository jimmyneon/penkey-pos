"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Input, Label } from "@penkey/ui";
import { createSupabaseClient } from "@/lib/database";
import { hapticSuccess, hapticButtonPress, hapticDelete } from "@/lib/utils/haptics";
import { Loader2, Upload, Trash2, Camera } from "lucide-react";
import { SelectModifierGroupDialog } from "./select-modifier-group-dialog";
import { CategorySelectorDialog } from "../sell/category-selector-dialog";
import { ImageUploadDialog } from "@/components/image-upload-dialog";
import { ItemImagePreview } from "@/components/item-image-preview";
import { useToast } from "@/lib/hooks/use-toast";
import { SyncManager } from "@/lib/services/sync-manager";
import { dataCache } from "@/lib/services/data-cache";
import { getByKey } from "@/lib/idb/db";
import { setModifierGroupItems } from "@/lib/services/modifier-assignment";

interface QuickEditItemDialogProps {
  open: boolean;
  onClose: () => void;
  item: any;
  categories: any[];
  onSuccess: () => void;
  orgId: string;
}

export function QuickEditItemDialog({
  open,
  onClose,
  item,
  categories,
  onSuccess,
  orgId,
}: QuickEditItemDialogProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category_id: "" as string | null,
    base_price: "",
    sku: "",
    description: "",
    image_url: "",
    is_active: true,
    show_online: true,
  });
  const [modifiersLoading, setModifiersLoading] = useState(false);
  const [assignedGroups, setAssignedGroups] = useState<Array<{ id: string; name: string; selection_type: string }>>([]);
  const [pickModifierOpen, setPickModifierOpen] = useState(false);
  const [pickCategoryOpen, setPickCategoryOpen] = useState(false);
  const [uploadImageOpen, setUploadImageOpen] = useState(false);
  const [viewImageOpen, setViewImageOpen] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || "",
        category_id: item.category_id || "",
        base_price: item.base_price?.toString() || "",
        sku: item.sku || "",
        description: item.description || "",
        image_url: item.image_url || "",
        is_active: item.is_active ?? true,
        show_online: item.show_online ?? true,
      });
      // Load assigned modifier groups for this item (IDB-first for speed)
      (async () => {
        try {
          setModifiersLoading(true);
          
          // 1) Try IndexedDB first (instant)
          try {
            const row: any = await getByKey('item_modifier_groups', item.id as any);
            if (row?.groups && row.groups.length > 0) {
              console.log(`[QuickEditDialog] ⚡ Loaded ${row.groups.length} modifier groups from IndexedDB for item ${item.id}`);
              setAssignedGroups(row.groups);
              setModifiersLoading(false);
              return;
            }
          } catch (idbErr) {
            console.log('[QuickEditDialog] IndexedDB lookup failed, falling back to API:', idbErr);
          }
          
          // 2) Fallback to API if not in IndexedDB
          const sessionData = sessionStorage.getItem('pos_session');
          if (!sessionData) {
            console.error('Session not found');
            setAssignedGroups([]);
            setModifiersLoading(false);
            return;
          }
          
          console.log('[QuickEditDialog] Fetching modifier groups from API for item:', item.id);
          const resp = await fetch(`/api/items/${item.id}/modifiers`, {
            headers: {
              'x-pos-session': sessionData,
            },
          });
          if (resp.ok) {
            const data = await resp.json();
            setAssignedGroups(data || []);
          } else {
            setAssignedGroups([]);
          }
        } catch (e) {
          console.error("Failed to load item modifiers", e);
          setAssignedGroups([]);
        } finally {
          setModifiersLoading(false);
        }
      })();
    }
  }, [item]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || (!formData.base_price && !item.has_variants)) {
      showToast("Please fill in required fields", "error");
      return;
    }

    setLoading(true);
    hapticButtonPress();

    try {
      const updateData: any = {
        name: formData.name,
        category_id: formData.category_id === "__uncategorised__" || formData.category_id === "" || !formData.category_id ? null : formData.category_id,
        sku: formData.sku || null,
        description: formData.description || null,
        image_url: formData.image_url || null,
        is_active: formData.is_active,
        show_online: formData.show_online,
      };

      // Only update price if item doesn't have variants
      if (!item.has_variants) {
        updateData.base_price = parseFloat(formData.base_price);
      }

      const sessionData = sessionStorage.getItem('pos_session');
      if (!sessionData) {
        showToast('Session expired. Please log in again.', 'error');
        setLoading(false);
        return;
      }

      console.log('Updating item with data:', updateData);
      let queued = false;
      try {
        const response = await fetch(`/api/items/${item.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-pos-session": sessionData,
          },
          body: JSON.stringify(updateData),
        });

        if (!response.ok) {
          // 5xx -> queue to outbox so the edit isn't lost; 4xx -> surface error
          if (response.status >= 500) {
            const { OutboxSyncService } = await import('@/lib/services/outbox-sync');
            await OutboxSyncService.addToOutbox('item_update', { id: item.id, ...updateData }, orgId, true);
            queued = true;
          } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to update item");
          }
        }
      } catch (netErr: any) {
        // Network error / offline → queue to outbox; the item edit is never lost.
        console.warn('[QuickEditDialog] Item PATCH failed, queueing to outbox', netErr);
        const { OutboxSyncService } = await import('@/lib/services/outbox-sync');
        await OutboxSyncService.addToOutbox('item_update', { id: item.id, ...updateData }, orgId, true);
        queued = true;
      }

      hapticSuccess();
      showToast(
        queued
          ? `${formData.name} saved (will sync when online)`
          : `${formData.name} updated successfully`,
        "success"
      );
      // Clear cache so items reload from API
      dataCache.clear(orgId, "items");
      SyncManager.clearSyncTimestamp(orgId, "ITEMS");
      onClose();
      onSuccess();
    } catch (error: any) {
      console.error("Failed to update item:", error);
      showToast(`Failed to update item: ${error.message || 'Unknown error'}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    
    hapticDelete();
    setLoading(true);

    try {
      const sessionData = sessionStorage.getItem('pos_session');
      if (!sessionData) {
        showToast('Session expired. Please log in again.', 'error');
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/items/${item.id}`, {
        method: "DELETE",
        headers: {
          "x-pos-session": sessionData,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete item");
      }
      
      hapticSuccess();
      showToast(`${item.name} deleted successfully`, "success");
      // Clear cache so items reload from API
      dataCache.clear(orgId, "items");
      SyncManager.clearSyncTimestamp(orgId, "ITEMS");
      onClose();
      onSuccess();
    } catch (error: any) {
      console.error("Failed to delete item:", error);
      showToast(`Failed to delete item: ${error.message || 'Unknown error'}`, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="w-[92vw] max-w-sm sm:max-w-md bg-[#3d3d3d] border-0 max-h-[90vh] overflow-y-auto scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch' as any }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl text-white">Edit Item</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-sm font-medium text-gray-300">
              Item Name *
            </Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Cappuccino"
              required
              className="mt-1 bg-[#2d2d2d] text-white border-gray-600"
            />

      {/* Category Selector Dialog */}
      <CategorySelectorDialog
        open={pickCategoryOpen}
        onClose={() => setPickCategoryOpen(false)}
        categories={categories}
        selectedCategory={formData.category_id || undefined}
        onSelectCategory={(categoryId: string | undefined) => {
          console.log('[QuickEditDialog] Category selected:', categoryId);
          setFormData({ ...formData, category_id: categoryId || null });
          setPickCategoryOpen(false);
        }}
        gridSize={4}
        showUncategorised
      />
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-300">
              Category
            </Label>
            <button
              type="button"
              onClick={() => setPickCategoryOpen(true)}
              className="mt-1 w-full bg-[#2d2d2d] text-white border border-gray-600 rounded-lg px-3 py-2 text-sm text-left hover:border-penkey-orange transition-colors"
            >
              {(() => {
                console.log('[QuickEditDialog] Displaying category - formData.category_id:', formData.category_id, 'categories:', categories.length);
                const cat = categories.find(c => c.id === formData.category_id);
                console.log('[QuickEditDialog] Found category:', cat?.name || 'Not found');
                return cat ? cat.name : "No Category";
              })()}
            </button>
          </div>

          {!item.has_variants && (
            <div>
              <Label htmlFor="price" className="text-sm font-medium text-gray-300">
                Price *
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.base_price}
                onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                placeholder="0.00"
                required
                className="mt-1 bg-[#2d2d2d] text-white border-gray-600"
              />
            </div>
          )}

          {item.has_variants && (
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3">
              <p className="text-sm text-blue-300">
                This item has variants. Edit variant prices individually.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="sku" className="text-sm font-medium text-gray-300">
              SKU
            </Label>
            <Input
              id="sku"
              type="text"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              placeholder="Optional"
              className="mt-1 bg-[#2d2d2d] text-white border-gray-600"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-300 block mb-2">
              Product Image
            </Label>
            <div className="flex items-center gap-3">
              <ItemImagePreview
                imageUrl={formData.image_url}
                itemName={formData.name}
                size="small"
                onClick={formData.image_url ? () => setViewImageOpen(true) : undefined}
              />
              <button
                type="button"
                onClick={() => setUploadImageOpen(true)}
                className="flex-1 min-h-[44px] bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition"
              >
                <Camera className="w-4 h-4" />
                {formData.image_url ? 'Change Image' : 'Upload Image'}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="description" className="text-sm font-medium text-gray-300">
              Description
            </Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional"
              rows={3}
              className="mt-1 w-full bg-[#2d2d2d] text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-penkey-orange placeholder:text-gray-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-penkey-orange border-gray-600 rounded focus:ring-penkey-orange bg-[#2d2d2d]"
            />
            <Label htmlFor="is_active" className="text-sm font-medium cursor-pointer text-gray-300">
              Active (visible in POS)
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="show_online"
              checked={formData.show_online}
              onChange={(e) => setFormData({ ...formData, show_online: e.target.checked })}
              className="w-4 h-4 text-penkey-orange border-gray-600 rounded focus:ring-penkey-orange bg-[#2d2d2d]"
            />
            <Label htmlFor="show_online" className="text-sm font-medium cursor-pointer text-gray-300">
              Show online
            </Label>
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
              type="submit"
              disabled={loading}
              className="flex-1 bg-penkey-orange hover:bg-penkey-orange/90"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>

          {/* Modifiers Section */}
          <div className="pt-4 border-t border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium text-gray-300">Modifier Groups</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/10"
                onClick={() => setPickModifierOpen(true)}
              >
                Add group
              </Button>
            </div>
            {modifiersLoading ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : assignedGroups.length ? (
              <div className="space-y-2">
                {assignedGroups.map((g) => (
                  <div key={g.id} className="flex items-center justify-between bg-[#2d2d2d] rounded-lg px-3 py-2">
                    <div>
                      <p className="text-white text-sm">{g.name}</p>
                      <p className="text-xs text-gray-400 capitalize">{g.selection_type}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={async () => {
                        try {
                          // Fetch all items currently assigned to this group, then
                          // PUT the reconciled set without the current item.
                          const sessionData = sessionStorage.getItem('pos_session');
                          if (!sessionData) {
                            alert('Session expired. Please log in again.');
                            return;
                          }
                          const resp = await fetch(`/api/items/modifiers?modifier_group_id=${g.id}`, {
                            headers: { 'x-pos-session': sessionData },
                          });
                          if (!resp.ok) throw new Error("Failed to fetch group assignments");
                          const data: { item_id: string }[] = await resp.json();
                          const previous = data.map((x) => x.item_id);
                          const desired = previous.filter((id) => id !== item.id);
                          const result = await setModifierGroupItems({
                            modifierGroupId: g.id,
                            itemIds: desired,
                            orgId,
                            previousItemIds: previous,
                          });
                          if (!result.ok && !result.queued) {
                            throw new Error(result.error || 'Failed to remove modifier group');
                          }
                          setAssignedGroups((prev) => prev.filter((x) => x.id !== g.id));
                        } catch (e) {
                          console.error(e);
                          alert("Failed to remove modifier group");
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No modifier groups</p>
            )}
          </div>

          {/* Delete Button */}
          <div className="pt-4 border-t border-gray-700">
            <Button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Item
            </Button>
          </div>
        </form>
      </DialogContent>

      {/* Image Upload Dialog - rendered outside form */}
      {uploadImageOpen && (
        <ImageUploadDialog
          itemId={item.id}
          itemName={formData.name}
          currentImageUrl={formData.image_url}
          onUploadComplete={(imageUrl) => {
            console.log('[QuickEditDialog] Image uploaded:', imageUrl);
            setFormData({ ...formData, image_url: imageUrl });
            // Clear cache so items list refreshes with new image
            dataCache.clear(orgId, 'items');
            SyncManager.clearSyncTimestamp(orgId, 'ITEMS');
            showToast('Image uploaded successfully', 'success');
          }}
          onClose={() => setUploadImageOpen(false)}
        />
      )}

      {/* Select Modifier Group Dialog */}
      <SelectModifierGroupDialog
        open={pickModifierOpen}
        onClose={() => setPickModifierOpen(false)}
        orgId={orgId}
        onSelect={async (group) => {
          try {
            // Get current assignments for this group, then PUT the union
            // (current ∪ this item) via the set-based reconcile helper.
            const sessionData = sessionStorage.getItem('pos_session');
            if (!sessionData) {
              alert('Session expired. Please log in again.');
              return;
            }
            const resp = await fetch(`/api/items/modifiers?modifier_group_id=${group.id}`, {
              headers: { 'x-pos-session': sessionData },
            });
            const current: { item_id: string }[] = resp.ok ? await resp.json() : [];
            const previousIds = current.map((x) => x.item_id);
            const desiredIds = Array.from(new Set([...previousIds, item.id]));

            const result = await setModifierGroupItems({
              modifierGroupId: group.id,
              itemIds: desiredIds,
              orgId,
              previousItemIds: previousIds,
            });
            if (!result.ok && !result.queued) {
              throw new Error(result.error || 'Failed to assign modifier group');
            }

            // Refresh local list shown in the dialog
            const fresh = await fetch(`/api/items/${item.id}/modifiers`, {
              headers: { 'x-pos-session': sessionData },
            });
            const data = fresh.ok ? await fresh.json() : [];
            setAssignedGroups(data || []);
            setPickModifierOpen(false);
          } catch (e) {
            console.error(e);
            alert("Failed to assign modifier group");
          }
        }}
      />

      {/* Image Viewer Modal */}
      {viewImageOpen && formData.image_url && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[10000] pointer-events-auto"
          onClick={() => setViewImageOpen(false)}
        >
          <div 
            className="relative max-w-2xl max-h-[80vh] pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setViewImageOpen(false)}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/80 text-white rounded-full w-10 h-10 flex items-center justify-center transition pointer-events-auto z-10"
            >
              ✕
            </button>
            <Image
              src={formData.image_url}
              alt={formData.name}
              width={800}
              height={800}
              className="max-w-full max-h-[80vh] object-contain"
            />
          </div>
        </div>
      )}

    </Dialog>
  );
}
