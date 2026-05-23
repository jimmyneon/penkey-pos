"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Sparkles } from "lucide-react";
import { formatCurrency } from "@penkey/ui";
import { hapticButtonPress } from "@/lib/utils/haptics";
import { upsellAnalytics } from "@/lib/services/upsell-analytics";

interface UpsellItem {
  id: string;
  name: string;
  image_url: string | null;
  base_price: number | null;
  has_variants: boolean;
  item_variants?: Array<{
    id: string;
    name: string;
    price: number;
    is_default: boolean;
  }>;
  suggestion_reason: string;
}

interface UpsellPanelProps {
  open: boolean;
  onClose: () => void;
  suggestions: UpsellItem[];
  onSelectItem: (item: UpsellItem, event?: React.MouseEvent) => void;
  autoDismissSeconds?: number;
  triggerItem?: { id: string; name: string };
  orgId?: string;
  memberId?: string;
  gridSize?: 2 | 3 | 4 | 5 | 6;
  font_size?: "very_small" | "small" | "medium" | "large";
}

export function UpsellPanel({
  open,
  onClose,
  suggestions,
  onSelectItem,
  autoDismissSeconds = 3,
  triggerItem,
  orgId,
  memberId,
  gridSize = 3,
  font_size = "medium",
}: UpsellPanelProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [countdown, setCountdown] = useState(autoDismissSeconds);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (open) {
      setIsVisible(true);
      setCountdown(autoDismissSeconds);
      setIsPaused(false);

      if (triggerItem && orgId && suggestions.length > 0) {
        upsellAnalytics.trackShown(
          orgId,
          triggerItem,
          suggestions,
          memberId
        );
      }
    } else {
      setIsVisible(false);
    }
  }, [open, autoDismissSeconds, triggerItem, orgId, suggestions, memberId]);

  const handleClose = useCallback((isAuto: boolean = false) => {
    if (triggerItem && orgId && suggestions.length > 0) {
      upsellAnalytics.trackDismissed(
        orgId,
        triggerItem,
        suggestions,
        isAuto,
        memberId
      );
    }

    setIsVisible(false);
    setTimeout(() => onClose(), 300);
  }, [triggerItem, orgId, suggestions, memberId, onClose]);

  // Separate effect for countdown timer that respects pause state
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!open || autoDismissSeconds === 0 || isPaused) {
      if (isPaused) {
        console.log('[Upsell] Timer paused - stopped');
      }
      return; // Don't run timer if closed, disabled, or paused
    }

    console.log('[Upsell] Starting timer, countdown:', countdown);

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        console.log('[Upsell] Tick:', prev);
        if (prev <= 1) {
          console.log('[Upsell] Timer expired - auto-closing');
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          handleClose(true); // true = auto-dismissed
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      console.log('[Upsell] Cleanup - clearing timer');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [open, autoDismissSeconds, isPaused, handleClose]);

  const handleSelectItem = (item: UpsellItem, event: React.MouseEvent) => {
    hapticButtonPress();

    // Track acceptance
    if (triggerItem && orgId) {
      upsellAnalytics.trackAccepted(
        orgId,
        triggerItem,
        item,
        memberId
      );
    }

    onSelectItem(item, event);
    handleClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={() => handleClose(false)}
      />

      {/* Panel */}
      <div
        className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 ${
          isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        } transition-opacity duration-300`}
      >
        <div
          className={`bg-[#3d3d3d] rounded-t-3xl sm:rounded-xl p-6 w-full sm:max-w-md max-h-[85vh] overflow-y-auto shadow-2xl transition-transform ease-out ${
            isVisible ? "translate-y-0" : "translate-y-full"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1 mt-2">
            <h3 className="text-xl font-semibold text-white flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-penkey-orange" />
              You might also like
            </h3>
            {autoDismissSeconds > 0 && (
              <p className="text-gray-400 text-xs mt-0.5">
                {isPaused ? "Paused" : `Closing in ${countdown}s`}
              </p>
            )}
          </div>
          <button
            onClick={() => handleClose(false)}
            className="text-gray-400 hover:text-white text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Suggestions Grid */}
        <div className="space-y-4">
          {suggestions.length > 0 ? (
            <div className={`grid gap-3 ${
              gridSize === 2 ? 'grid-cols-2' :
              gridSize === 3 ? 'grid-cols-3' :
              gridSize === 4 ? 'grid-cols-3' :
              gridSize === 5 ? 'grid-cols-3' :
              'grid-cols-3'
            }`}>
              {suggestions.map((item) => {
                const price = item.has_variants
                  ? item.item_variants?.[0]?.price || 0
                  : item.base_price || 0;
                const hasImage = item.image_url;

                return (
                  <button
                    key={item.id}
                    onClick={(e) => handleSelectItem(item, e)}
                    className="relative rounded-lg overflow-hidden transition-all aspect-square bg-[#5d5d5d] active:bg-penkey-orange active:scale-95"
                  >
                    {/* Image Background */}
                    {hasImage && (
                      <img 
                        src={item.image_url!} 
                        alt={item.name}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                    
                    {/* Content Overlay */}
                    <div className={`absolute inset-0 flex flex-col items-center justify-center ${
                      gridSize >= 5 ? 'p-1 sm:p-1.5' :
                      gridSize === 4 ? 'p-1.5 sm:p-2' :
                      'p-2 sm:p-3'
                    } ${hasImage ? 'bg-black/40' : ''}`}>
                      <h3 className={`font-medium text-center leading-tight text-white drop-shadow-lg mb-1 ${
                        font_size === "very_small" ? "text-[10px] sm:text-xs" :
                        font_size === "small" ? "text-xs sm:text-sm" :
                        font_size === "medium" ? "text-sm sm:text-base" :
                        "text-lg sm:text-xl"
                      }`}>
                        {item.name}
                      </h3>
                      <p className={`text-penkey-orange font-bold drop-shadow-lg ${
                        font_size === "very_small" ? "text-xs sm:text-sm" :
                        font_size === "small" ? "text-sm sm:text-base" :
                        font_size === "medium" ? "text-sm sm:text-base" :
                        "text-base sm:text-lg"
                      }`}>
                        {formatCurrency(price)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">No suggestions available</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-700">
          <button
            onClick={() => handleClose(false)}
            className="w-full bg-gray-600 active:bg-gray-700 text-white font-semibold py-3 sm:py-4 rounded-lg transition-colors text-sm sm:text-base"
          >
            No thanks
          </button>
        </div>
      </div>
    </>
  );
}
