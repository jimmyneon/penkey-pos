"use client";

import { useState, useEffect } from "react"; 
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Input, Label, Select } from "@penkey/ui"; 
import { Loader2 } from "lucide-react";
import { hapticButtonPress, hapticSuccess } from "@/lib/utils/haptics";

interface QuickAddItemDialogProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  categories: any[];
  onSuccess: () => void;
}

export function QuickAddItemDialog({
  open,
  onClose,
  orgId,
  categories,
  onSuccess,
}: QuickAddItemDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    base_price: "",
    sku: "",
    description: "",
  });

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
    
    if (!formData.name || !formData.base_price) {
      alert("Please fill in required fields");
      return;
    }

    setLoading(true);
    hapticButtonPress();

    try {
      console.log('Attempting to add item with category_id:', formData.category_id);
      const response = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          name: formData.name,
          category_id: formData.category_id === "" ? null : formData.category_id,
          base_price: formData.base_price,
          sku: formData.sku || null,
          description: formData.description || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add item");
      }

      console.log('Item added successfully');
      hapticSuccess();
      setFormData({
        name: "",
        category_id: "",
        base_price: "",
        sku: "",
        description: "",
      });
      onSuccess();
    } catch (error: any) {
      console.error("Failed to add item:", error);
      alert(error.message || "Failed to add item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[92vw] max-w-sm sm:max-w-md bg-[#3d3d3d] border-0 max-h-[90vh] overflow-y-auto scrollbar-hide">
        <DialogHeader>
          <DialogTitle className="text-xl text-white">Add New Item</DialogTitle>
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
          </div>

          <div>
            <Label htmlFor="category" className="text-sm font-medium text-gray-300">
              Category
            </Label>
            <select
              id="category"
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="mt-1 w-full bg-[#2d2d2d] text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-penkey-orange appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                backgroundPosition: 'right 0.5rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1.5em 1.5em',
                paddingRight: '2.5rem'
              }}
            >
              <option value="" className="bg-[#2d2d2d] text-white">No Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id} className="bg-[#2d2d2d] text-white">
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

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
                  Adding...
                </>
              ) : (
                "Add Item"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
