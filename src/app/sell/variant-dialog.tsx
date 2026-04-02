"use client";

import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Badge } from "@penkey/ui";
import { formatCurrency } from "@penkey/ui";
import { hapticButtonPress } from "@/lib/utils/haptics";
import { useScrollLock } from "@/hooks/use-scroll-lock";

interface Variant {
  id: string;
  name: string;
  price: number;
  is_default: boolean;
}

interface VariantDialogProps {
  open: boolean;
  onClose: () => void;
  itemName: string;
  variants: Variant[];
  gridSize?: 2 | 3 | 4 | 5 | 6;
  onSelect: (variant: Variant) => void;
}

export function VariantDialog({
  open,
  onClose,
  itemName,
  variants,
  gridSize = 3,
  onSelect,
}: VariantDialogProps) {
  // Use scroll lock hook to manage scroll state
  useScrollLock(open);

  const handleVariantClick = (variant: Variant) => {
    hapticButtonPress();
    onSelect(variant);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-[#3d3d3d] text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-xl text-white">Select Size</DialogTitle>
          <DialogDescription className="text-sm text-gray-400">{itemName}</DialogDescription>
        </DialogHeader>

        <div className={`grid gap-2 md:gap-3 py-4 ${
          gridSize === 2 ? 'grid-cols-2' :
          gridSize === 3 ? 'grid-cols-3' :
          gridSize === 4 ? 'grid-cols-4' :
          gridSize === 5 ? 'grid-cols-5' :
          'grid-cols-6'
        }`}>
          {variants.map((variant) => (
            <button
              key={variant.id}
              onClick={() => handleVariantClick(variant)}
              className={`relative rounded-lg transition-all text-center aspect-square flex flex-col items-center justify-center bg-[#5d5d5d] hover:bg-penkey-orange ${
                gridSize >= 5 ? 'p-2' : gridSize === 4 ? 'p-2.5' : 'p-4'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <span className={`font-bold text-white ${
                  gridSize >= 5 ? 'text-sm' : gridSize === 4 ? 'text-base' : 'text-lg'
                }`}>
                  {variant.name}
                </span>
                {variant.is_default && (
                  <Badge variant="outline" className="text-xs border-white/30 text-white">
                    Popular
                  </Badge>
                )}
                <span className={`font-bold text-white ${
                  gridSize >= 5 ? 'text-base' : gridSize === 4 ? 'text-lg' : 'text-xl'
                }`}>
                  {formatCurrency(variant.price)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
