"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Input, Label } from "@penkey/ui";
import { createSupabaseClient } from "@penkey/database";
import { hapticSuccess, hapticButtonPress, hapticDelete } from "@/lib/utils/haptics";
import { Loader2, Trash2 } from "lucide-react";

interface QuickEditModifierDialogProps {
  open: boolean;
  onClose: () => void;
  modifier: any;
  onSuccess: () => void;
}

export function QuickEditModifierDialog({
  open,
  onClose,
  modifier,
  onSuccess,
}: QuickEditModifierDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    group_name: "",
    is_active: true,
  });

  useEffect(() => {
    if (modifier) {
      setFormData({
        name: modifier.name || "",
        price: modifier.price?.toString() || "",
        group_name: modifier.group_name || modifier.description || "",
        is_active: modifier.is_active ?? true,
      });
    }
  }, [modifier]);

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
    
    if (!formData.name || !formData.price) {
      alert("Please fill in required fields");
      return;
    }

    setLoading(true);
    hapticButtonPress();

    try {
      const supabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase
        .from("modifier_options")
        .update({
          name: formData.name,
          price_adjustment: parseFloat(formData.price),
          is_active: formData.is_active,
        })
        .eq("id", modifier.id);

      if (error) throw error;

      hapticSuccess();
      onSuccess();
    } catch (error) {
      console.error("Failed to update modifier:", error);
      alert("Failed to update modifier");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${modifier.name}"? This cannot be undone.`)) return;
    
    hapticDelete();
    setLoading(true);

    try {
      const supabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { error } = await supabase
        .from("modifier_options")
        .update({ is_active: false })
        .eq("id", modifier.id);
      
      if (error) throw error;
      
      hapticSuccess();
      onSuccess();
    } catch (error) {
      console.error("Failed to delete modifier:", error);
      alert("Failed to delete modifier");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-[#3d3d3d] max-h-[90vh] overflow-y-auto scrollbar-hide">
        <DialogHeader>
          <DialogTitle className="text-xl text-white">Edit Modifier</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-sm font-medium text-gray-300">
              Modifier Name *
            </Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Extra Shot, Oat Milk"
              required
              className="mt-1 bg-[#2d2d2d] text-white border-gray-600"
            />
          </div>

          <div>
            <Label htmlFor="price" className="text-sm font-medium text-gray-300">
              Additional Price *
            </Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="0.00"
              required
              className="mt-1 bg-[#2d2d2d] text-white border-gray-600"
            />
            <p className="text-xs text-gray-400 mt-1">Price added to item total</p>
          </div>

          {formData.group_name && (
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3">
              <p className="text-sm text-blue-300">
                Group: <span className="font-semibold">{formData.group_name}</span>
              </p>
            </div>
          )}

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
              Delete Modifier
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
