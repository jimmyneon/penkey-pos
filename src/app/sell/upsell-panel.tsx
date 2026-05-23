"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { X, Plus, Package } from "lucide-react";
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (open) {
      // Trigger slide-up animation immediately
      setIsVisible(true);
      setCountdown(autoDismissSeconds);
      setIsPaused(false); // Reset pause state

      // Track that suggestions were shown
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
      setIsExpanded(false);
      setDragOffset(0);
    }
  }, [open, autoDismissSeconds, triggerItem, orgId, suggestions, memberId]);

  // Swipe gesture handlers
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Don't handle swipes on buttons
    if (target.closest('button:not(.drag-handle)')) {
      return;
    }
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientY);
    // Pause timer when user starts interacting
    setIsPaused(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    
    const target = e.target as HTMLElement;
    // Don't handle swipes on buttons
    if (target.closest('button:not(.drag-handle)')) {
      return;
    }
    
    const currentTouch = e.targetTouches[0].clientY;
    const diff = currentTouch - touchStart;
    
    // Only allow dragging down or up
    if (diff > 0) {
      // Dragging down - allow with resistance
      setDragOffset(Math.min(diff * 0.5, 200));
    } else {
      // Dragging up - allow with resistance
      setDragOffset(Math.max(diff * 0.3, -100));
    }
    setTouchEnd(currentTouch);
  };

  const onTouchEnd = () => {
    if (touchStart === null) return;
    
    if (touchEnd !== null) {
      const distance = touchStart - touchEnd;
      const isUpSwipe = distance > minSwipeDistance;
      const isDownSwipe = distance < -minSwipeDistance;
      
      if (isDownSwipe) {
        // Swipe down - dismiss
        console.log('[Upsell] Swipe down detected - dismissing');
        handleClose(false);
        setDragOffset(0);
        setTouchStart(null);
        setTouchEnd(null);
        return;
      } else if (isUpSwipe) {
        // Swipe up - expand and lock
        console.log('[Upsell] Swipe up detected - expanding and locking');
        setIsExpanded(true);
        setIsPaused(true);
      }
    }
    
    // Reset drag offset
    setDragOffset(0);
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Pause timer when scrolling content
  const handleScroll = () => {
    if (!isPaused) {
      console.log('[Upsell] Scrolling detected - pausing timer');
      setIsPaused(true);
    }
  };

  const handleClose = useCallback((isAuto: boolean = false) => {
    // Track dismissal
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
    setTimeout(() => onClose(), 200); // Wait for slide-down animation
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
        className={`fixed bottom-0 left-0 right-0 z-50 bg-[#3d3d3d] rounded-t-3xl sm:rounded-xl shadow-2xl transition-transform ease-out ${
          isVisible ? "translate-y-0" : "translate-y-full"
        } ${isExpanded ? 'max-h-[85vh]' : 'max-h-[50vh]'}`}
        style={{
          transform: `translateY(${dragOffset}px)`,
          transitionDuration: dragOffset !== 0 ? '0ms' : '200ms'
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Header with drag handle */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-4 border-b border-gray-700 drag-handle">
          {/* Drag handle indicator */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-gray-600 rounded-full" />
          
          <div className="flex-1 mt-2">
            <h3 className="text-white font-bold text-base sm:text-lg">You might also like</h3>
            {autoDismissSeconds > 0 && !isExpanded && (
              <p className="text-gray-400 text-xs mt-0.5">
                {isPaused ? "Swipe up to expand" : `Closing in ${countdown}s`}
              </p>
            )}
            {isExpanded && (
              <p className="text-gray-400 text-xs mt-0.5">
                Swipe down to close
              </p>
            )}
          </div>
          <button
            onClick={() => handleClose(false)}
            className="text-gray-400 active:text-white transition-colors p-2 -mr-2 flex-shrink-0"
            aria-label="Close"
          >
            <X className="h-6 w-6 sm:h-7 sm:w-7" />
          </button>
        </div>

        {/* Suggestions Grid */}
        <div 
          className={`p-3 sm:p-4 overflow-y-auto ${isExpanded ? 'max-h-[calc(85vh-120px)]' : 'max-h-[calc(50vh-120px)]'}`}
          onScroll={handleScroll}
        >
          {suggestions.length > 0 ? (
            <div className={`grid gap-2 sm:gap-3 ${
              gridSize === 2 ? 'grid-cols-2' :
              gridSize === 3 ? 'grid-cols-3' :
              gridSize === 4 ? 'grid-cols-4' :
              gridSize === 5 ? 'grid-cols-5' :
              'grid-cols-6'
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
        <div className="px-3 sm:px-4 py-3 sm:py-4 border-t border-gray-700 safe-area-inset-bottom">
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
