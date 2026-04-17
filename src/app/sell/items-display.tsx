"use client";

import { Package } from "lucide-react";
import { formatCurrency } from "@penkey/ui";
import type { Item } from "@/lib/hooks/use-items";

interface ItemsDisplayProps {
  displayLoading: boolean;
  filteredItems: Item[];
  layout: "grid" | "list";
  gridSize?: 2 | 3 | 4 | 5 | 6;
  font_size?: "very_small" | "small" | "medium" | "large";
  clickedItemId: string | null;
  onAddItem: (item: Item, e: React.MouseEvent) => void;
}

// Extract the main product word from a category name
// Simple heuristic: takes the last word, which is often the main product
// Example: "carrot soup" → "soup", "buttered chicken" → "chicken"
const extractMainProductWord = (categoryName: string): string => {
  if (!categoryName) return "";
  const words = categoryName.trim().split(/\s+/);
  return words[words.length - 1] || categoryName;
};

export function ItemsDisplay({
  displayLoading,
  filteredItems,
  layout,
  gridSize = 3,
  font_size = "medium",
  clickedItemId,
  onAddItem,
}: ItemsDisplayProps) {
  if (displayLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Loading items...</p>
      </div>
    );
  }

  if (filteredItems.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">No items in this category</p>
      </div>
    );
  }

  if (layout === "grid") {
    // Grid columns apply to ALL screen sizes based on gridSize setting
    // User can choose 2-6 columns on any device
    let gridColsClass = "grid-cols-3";
    if (gridSize === 2) {
      gridColsClass = "grid-cols-2";
    } else if (gridSize === 3) {
      gridColsClass = "grid-cols-3";
    } else if (gridSize === 4) {
      gridColsClass = "grid-cols-4";
    } else if (gridSize === 5) {
      gridColsClass = "grid-cols-5";
    } else if (gridSize === 6) {
      gridColsClass = "grid-cols-6";
    }
    
    // Text sizing based on font_size setting
    const getTextSizeClass = () => {
      switch (font_size) {
        case "very_small":
          return "text-[10px] sm:text-xs";
        case "small":
          return "text-xs sm:text-sm";
        case "medium":
          return "text-sm sm:text-base";
        case "large":
          return "text-lg sm:text-xl";
        default:
          return "text-sm sm:text-base";
      }
    };

    // Category text size for large mode
    const getCategorySizeClass = () => {
      return font_size === "large" ? "text-[10px] sm:text-xs" : "hidden";
    };

    // Responsive padding - less padding for more columns
    const paddingClass = gridSize >= 5
      ? "p-1 sm:p-1.5"
      : gridSize === 4
      ? "p-1.5 sm:p-2"
      : "p-2 sm:p-3";
    
    // Responsive gap
    const gapClass = "gap-2 sm:gap-3 lg:gap-4";
    
    return (
      <div 
        className={`grid ${gridColsClass} ${gapClass} overflow-y-auto scrollbar-hide`} 
        style={{ 
          maxHeight: 'calc(100vh - 250px)', // Account for header (106px) + Penkey bar (74px) + padding (70px)
          paddingBottom: '80px', // Extra space at bottom
          alignContent: 'start'
        }}
      >
        {filteredItems.map((item) => {
          const hasImage = item.image_url;
          const isClicked = clickedItemId === item.id;
          
          return (
            <button
              key={item.id}
              onClick={(e) => onAddItem(item, e)}
              className={`relative rounded-lg overflow-hidden transition-all aspect-square ${
                isClicked ? 'bg-penkey-orange' : 'bg-[#5d5d5d]'
              }`}
            >
              {hasImage && (
                <img 
                  src={item.image_url!} 
                  alt={item.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              <div className={`absolute inset-0 flex flex-col items-center justify-center ${paddingClass} ${hasImage ? 'bg-black/40' : ''}`}>
                <h3 className={`item-button-text ${getTextSizeClass()} font-medium text-center leading-tight text-white drop-shadow-lg break-words ${font_size === "large" ? "line-clamp-2" : "line-clamp-3"}`}>
                  {font_size === "large" ? item.name.slice(0, 18) : item.name}
                </h3>
                {font_size === "large" && item.categories && (
                  <p className={`${getCategorySizeClass()} text-white/80 mt-1`}>
                    {extractMainProductWord(item.categories.name)}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // List view
  return (
    <div 
      className="space-y-2 sm:space-y-3 overflow-y-auto scrollbar-hide" 
      style={{ 
        maxHeight: 'calc(100vh - 250px)',
        paddingBottom: '80px'
      }}
    >
      {filteredItems.map((item) => {
        const price = item.has_variants 
          ? Math.min(...item.item_variants.map((v) => v.price))
          : item.base_price || 0;
        const isClicked = clickedItemId === item.id;
        
        return (
          <button
            key={item.id}
            onClick={(e) => onAddItem(item, e)}
            className={`w-full text-white rounded-lg p-3 sm:p-4 flex items-center gap-3 transition-all ${
              isClicked ? 'bg-penkey-orange' : 'bg-[#5d5d5d]'
            }`}
          >
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[#5d5d5d]">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-6 w-6 sm:h-8 sm:w-8 text-white/50" />
                </div>
              )}
            </div>
            <div className="flex-1 text-left">
              <h3 className="item-button-text font-semibold">{item.name}</h3>
              {item.categories && (
                <p className="text-xs text-gray-300">{item.categories.name}</p>
              )}
            </div>
            <div className="text-right">
              <p className="font-bold text-base sm:text-lg text-penkey-orange">
                {item.has_variants ? `from ` : ''}{formatCurrency(price)}
              </p>
              {item.has_variants && (
                <p className="text-xs text-gray-300">{item.item_variants.length} options</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
