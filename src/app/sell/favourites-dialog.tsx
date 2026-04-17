"use client";

import { useState, useEffect } from "react";
import { X, Star, Loader2 } from "lucide-react";
import { formatCurrency } from "@penkey/ui";
import { hapticButtonPress, hapticItemAdded } from "@/lib/utils/haptics";
import { playButtonSound, playItemAddedSound } from "@/lib/utils/sounds";

interface FavouritesDialogProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  onAddItem: (item: any) => void;
}

export function FavouritesDialog({
  open,
  onClose,
  orgId,
  onAddItem,
}: FavouritesDialogProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && orgId) {
      fetchFavourites();
    }
  }, [open, orgId]);

  const fetchFavourites = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/items?org_id=${orgId}&favourites=true`);
      if (!response.ok) throw new Error("Failed to fetch favourites");
      
      const data = await response.json();
      setItems(data);
    } catch (error) {
      console.error("Failed to fetch favourites:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = (item: any) => {
    hapticButtonPress();
    hapticItemAdded();
    playButtonSound();
    playItemAddedSound();
    onAddItem(item);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#3d3d3d] rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
            <h2 className="text-xl font-semibold text-white">Favourites</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-penkey-orange animate-spin" />
            </div>
          ) : items.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleAddItem(item)}
                  className="bg-[#2d2d2d] hover:bg-[#4d4d4d] transition-colors rounded-lg p-4 text-left group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-white font-medium text-sm line-clamp-2 group-hover:text-penkey-orange transition-colors">
                      {item.name}
                    </h3>
                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400 flex-shrink-0 ml-2" />
                  </div>
                  <p className="text-penkey-orange font-semibold">
                    {formatCurrency(item.base_price)}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Star className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No favourites yet</p>
              <p className="text-gray-500 text-sm mt-2">
                Go to Settings to add items to favourites
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
