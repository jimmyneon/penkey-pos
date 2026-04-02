"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Input, Label } from "@penkey/ui";
import { hapticSuccess, hapticButtonPress, hapticDelete } from "@/lib/utils/haptics";
import { Loader2, Trash2, Tag, Coffee, Pizza, IceCream, Sandwich, UtensilsCrossed, CupSoda, Beer, Wine, Egg, Fish, Cookie, ChefHat, Drumstick } from "lucide-react";

interface QuickEditCategoryDialogProps {
  open: boolean;
  onClose: () => void;
  category: any;
  onSuccess: () => void;
  onAssignItems?: () => void;
}

export function QuickEditCategoryDialog({
  open,
  onClose,
  category,
  onSuccess,
  onAssignItems,
}: QuickEditCategoryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    color: "#f97316",
    description: "",
    is_active: true,
    icon: "UtensilsCrossed",
    icon_color: "#ffffff",
  });

  // Themed colour packs: 8 themes x 10 colours each
  const colourThemes: Record<string, string[]> = {
    Penkey: [
      "#f97316", "#fb923c", "#ea580c", "#f59e0b", "#eab308",
      "#f43f5e", "#ef4444", "#22c55e", "#0ea5e9", "#6366f1",
    ],
    Vibrant: [
      "#ff6b6b", "#f06595", "#845ef7", "#339af0", "#22b8cf",
      "#20c997", "#51cf66", "#94d82d", "#fcc419", "#ff922b",
    ],
    Pastel: [
      "#ffd6a5", "#fdffb6", "#caffbf", "#9bf6ff", "#a0c4ff",
      "#bdb2ff", "#ffc6ff", "#ffadad", "#ffe3e3", "#d3f8e2",
    ],
    Earth: [
      "#7f5539", "#9c6644", "#b08968", "#ddb892", "#e6ccb2",
      "#a3b18a", "#588157", "#3a5a40", "#344e41", "#6b705c",
    ],
    Warm: [
      "#ff8a65", "#ff7043", "#ff5722", "#f4511e", "#e64a19",
      "#d84315", "#bf360c", "#ffa726", "#ffb74d", "#ffe082",
    ],
    Cool: [
      "#80deea", "#4dd0e1", "#26c6da", "#00bcd4", "#00acc1",
      "#4fc3f7", "#29b6f6", "#03a9f4", "#039be5", "#0288d1",
    ],
    Neon: [
      "#ff1b6b", "#45ffc8", "#2bff00", "#00ffd5", "#00b3ff",
      "#ff00f5", "#ffea00", "#ff5400", "#b6ff00", "#00fff0",
    ],
    Monochrome: [
      "#ffffff", "#f5f5f5", "#e0e0e0", "#bdbdbd", "#9e9e9e",
      "#757575", "#616161", "#424242", "#303030", "#1f2937",
    ],
  };
  const [selectedTheme, setSelectedTheme] = useState<keyof typeof colourThemes>("Penkey");

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || "",
        color: category.color || "#f97316",
        description: category.description || "",
        is_active: category.is_active ?? true,
        icon: category.icon || "UtensilsCrossed",
        icon_color: category.icon_color || "#ffffff",
      });
    }
  }, [category]);

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
    
    if (!formData.name) {
      alert("Please enter a category name");
      return;
    }

    setLoading(true);
    hapticButtonPress();

    try {
      console.log("[QuickEditCategory] Updating category:", category.id);
      console.log("[QuickEditCategory] Form data:", formData);

      const updateData = {
        name: formData.name,
        color: formData.color,
        description: formData.description || null,
        is_active: formData.is_active,
        icon: formData.icon,
        icon_color: formData.icon_color,
      };
      
      console.log("[QuickEditCategory] Update data:", updateData);

      const sessionData = sessionStorage.getItem('pos_session');
      if (!sessionData) {
        alert('Session expired. Please log in again.');
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/categories/${category.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-pos-session": sessionData,
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update category");
      }

      const data = await response.json();
      console.log("[QuickEditCategory] Update successful!", data);
      
      hapticSuccess();
      onSuccess();
    } catch (error: any) {
      console.error("[QuickEditCategory] Failed to update category:", error);
      alert(`Failed to update category: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${category.name}"? This cannot be undone.`)) return;
    
    hapticDelete();
    setLoading(true);

    try {
      const sessionData = sessionStorage.getItem('pos_session');
      if (!sessionData) {
        alert('Session expired. Please log in again.');
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/categories/${category.id}`, {
        method: "DELETE",
        headers: {
          "x-pos-session": sessionData,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete category");
      }
      
      hapticSuccess();
      onSuccess();
    } catch (error: any) {
      console.error("Failed to delete category:", error);
      alert(`Failed to delete category: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      modal={false}
    >
      <DialogContent className="w-[92vw] max-w-sm sm:max-w-md bg-[#3d3d3d] border-0 max-h-[90vh] overflow-y-auto scrollbar-hide">
        <DialogHeader>
          <DialogTitle className="text-xl text-white">Edit Category</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-sm font-medium text-gray-300">
              Category Name *
            </Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Coffee"
              required
              className="mt-1 bg-[#2d2d2d] text-white border-gray-600"
            />
          </div>

          <div>
            <Label htmlFor="color" className="text-sm font-medium text-gray-300">
              Colour
            </Label>
            {/* Theme selector - mini buttons */}
            <div className="mt-1 flex flex-wrap gap-2">
              {Object.keys(colourThemes).map((theme) => {
                const active = selectedTheme === (theme as keyof typeof colourThemes);
                return (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => {
                      hapticButtonPress();
                      setSelectedTheme(theme as keyof typeof colourThemes);
                    }}
                    className={`px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
                      active
                        ? "bg-penkey-orange border-penkey-orange text-white"
                        : "bg-[#2d2d2d] border-gray-600 text-gray-200 hover:border-gray-500"
                    }`}
                    aria-pressed={active}
                  >
                    {theme}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mt-1">
              <Input
                id="color"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-20 h-10 bg-[#2d2d2d] border-gray-600"
              />
              <Input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="#f97316"
                className="flex-1 bg-[#2d2d2d] text-white border-gray-600"
              />
            </div>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {colourThemes[selectedTheme].map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: hex })}
                  className={`h-9 rounded-lg border-2 transition-colors ${
                    formData.color.toLowerCase() === hex.toLowerCase()
                      ? "border-white"
                      : "border-gray-600 hover:border-gray-500"
                  }`}
                  style={{ backgroundColor: hex }}
                  aria-label={hex}
                />
              ))}
            </div>
          </div>

          {/* Icon selector */}
          <div>
            <Label className="text-sm font-medium text-gray-300">Icon</Label>
            <div className="mt-2 grid grid-cols-6 gap-2">
              {([
                ["UtensilsCrossed", UtensilsCrossed],
                ["Coffee", Coffee],
                ["CupSoda", CupSoda],
                ["Pizza", Pizza],
                ["Sandwich", Sandwich],
                ["IceCream", IceCream],
                ["Beer", Beer],
                ["Wine", Wine],
                ["Egg", Egg],
                ["Fish", Fish],
                ["Cookie", Cookie],
                ["Drumstick", Drumstick],
                ["ChefHat", ChefHat],
              ] as const).map(([name, IconComp]) => {
                const active = formData.icon === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      hapticButtonPress();
                      setFormData({ ...formData, icon: name });
                    }}
                    className={`aspect-square rounded-md border flex items-center justify-center transition-colors ${
                      active
                        ? "border-penkey-orange bg-white/10"
                        : "border-gray-600 bg-[#2d2d2d] hover:border-gray-500"
                    }`}
                    aria-pressed={active}
                    title={name}
                  >
                    <IconComp className="h-5 w-5" style={{ color: formData.icon_color }} />
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                type="color"
                value={formData.icon_color}
                onChange={(e) => setFormData({ ...formData, icon_color: e.target.value })}
                className="w-20 h-10 bg-[#2d2d2d] border-gray-600"
              />
              <Input
                type="text"
                value={formData.icon_color}
                onChange={(e) => setFormData({ ...formData, icon_color: e.target.value })}
                placeholder="#ffffff"
                className="flex-1 bg-[#2d2d2d] text-white border-gray-600"
              />
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

          {/* Assign Items Button */}
          {onAssignItems && (
            <div className="pt-4 border-t border-gray-700">
              <Button
                type="button"
                onClick={() => {
                  hapticButtonPress();
                  onAssignItems();
                }}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Tag className="h-4 w-4 mr-2" />
                Assign Items to Category
              </Button>
            </div>
          )}

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

          {/* Delete Button */}
          <div className="pt-4 border-t border-gray-700">
            <Button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Category
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
