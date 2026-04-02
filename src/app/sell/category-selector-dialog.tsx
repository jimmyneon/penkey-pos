"use client";

import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@penkey/ui";
import { Grid3x3, PackageX } from "lucide-react";

interface Category {
  id: string;
  name: string;
  color?: string;
}

interface CategorySelectorDialogProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  selectedCategory: string | undefined;
  onSelectCategory: (categoryId: string | undefined) => void;
  gridSize?: 2 | 3 | 4 | 5 | 6;
  showUncategorised?: boolean; // Show Uncategorised option (for items page)
}

export function CategorySelectorDialog({
  open,
  onClose,
  categories,
  selectedCategory,
  onSelectCategory,
  gridSize = 4,
  showUncategorised = false,
}: CategorySelectorDialogProps) {
  const handleSelect = (categoryId: string | undefined) => {
    onSelectCategory(categoryId);
    onClose();
  };

  // Force unlock scroll when dialog closes
  useEffect(() => {
    if (open) {
      // This effect ensures that if the component unmounts for any reason (like an error),
      // the scroll lock is removed.
      return () => {
        document.body.style.overflow = '';
        document.body.style.pointerEvents = '';
      };
    } else {
      // Also ensure unlock when dialog is explicitly closed without unmounting.
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
    }
  }, [open]);

  const isLightHex = (hex: string) => {
    const h = hex.replace('#', '');
    const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    const luminance = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
    return luminance > 0.7; // treat very light colors as light
  };

  // Dimming flags: when a specific category is chosen, dim the rest
  const hasConcreteSelection = selectedCategory !== undefined; // undefined = All Items
  const isUncategorisedSelected = selectedCategory === "__uncategorised__";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[92vw] max-w-lg bg-[#3d3d3d] text-white border-0 max-h-[80vh] overflow-y-auto scrollbar-hide">
        <DialogHeader>
          <DialogTitle className="text-xl text-white">Select Category</DialogTitle>
          <DialogDescription className="text-sm text-gray-400">
            Choose a category to filter items
          </DialogDescription>
        </DialogHeader>

        <div className={`grid gap-3 py-2 ${
          gridSize === 2 ? 'grid-cols-2' :
          gridSize === 3 ? 'grid-cols-3' :
          gridSize === 4 ? 'grid-cols-4' :
          gridSize === 5 ? 'grid-cols-5' :
          'grid-cols-6'
        }`}>
          {/* All Items Button */}
          <button
            onClick={() => handleSelect(undefined)}
            className={`aspect-square rounded-lg transition-all text-center flex flex-col items-center justify-center gap-2 p-2 ${
              !selectedCategory || selectedCategory === undefined
                ? "bg-penkey-orange"
                : "bg-[#5d5d5d] hover:bg-[#6d6d6d]"
            }`}
          >
            <Grid3x3 className="h-7 w-7 text-white" />
            <span className="block w-full px-1 font-bold text-xs sm:text-sm text-white text-center leading-tight break-words">
              All Items
            </span>
          </button>

          {/* Uncategorised Button (Items page only) */}
          {showUncategorised && (
            <button
              onClick={() => handleSelect("__uncategorised__")}
              className={`aspect-square rounded-lg transition-all text-center flex flex-col items-center justify-center gap-2 p-2 ${
                selectedCategory === "__uncategorised__"
                  ? "bg-penkey-orange"
                  : "bg-[#5d5d5d] hover:bg-[#6d6d6d]"
              } ${hasConcreteSelection && !isUncategorisedSelected ? "opacity-50 saturate-50" : ""}`}
            >
              <PackageX className="h-7 w-7 text-white" />
              <span className="block w-full px-1 font-bold text-xs sm:text-sm text-white text-center leading-tight break-words">
                Uncategorised
              </span>
            </button>
          )}

          {/* Category Buttons */}
          {categories.map((cat) => {
            const bg = cat.color || '#5d5d5d';
            const light = isLightHex(bg);
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleSelect(cat.id)}
                className={`w-full aspect-square rounded-lg overflow-hidden transition-all flex items-center justify-center p-2 ${
                  isSelected ? "ring-4 ring-penkey-orange" : ""
                } ${hasConcreteSelection && !isSelected && !isUncategorisedSelected ? "opacity-50 saturate-50" : ""}`}
                style={{ backgroundColor: bg }}
              >
                <span className={`block w-full px-1 font-bold text-xs sm:text-sm leading-tight text-center break-words ${
                  light ? 'text-black' : 'text-white drop-shadow-lg'
                }`}>
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
