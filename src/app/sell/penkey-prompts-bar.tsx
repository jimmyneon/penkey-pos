"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, TrendingUp, Target, Zap, Clock, Package, Trophy, Sparkles, User, TrendingDown, Coffee, Utensils, Moon } from "lucide-react";
import { formatCurrency } from "@penkey/ui";
import { hapticButtonPress, hapticItemAdded } from "@/lib/utils/haptics";

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
}

interface TopSellerItem {
  item_id: string;
  item_name: string;
  quantity_sold: number;
  revenue: number;
  image_url: string | null;
}

interface ShiftStats {
  transactions: number;
  total_sales: number;
  avg_ticket: number;
  items_sold: number;
  upsells: number;
  shift_duration_minutes: number;
}

interface PromptData {
  type: 'upsell' | 'stats' | 'motivation' | 'action' | 'tip' | 'top-sellers' | 'shift-summary' | 'context';
  icon: React.ReactNode;
  message: string;
  subtext?: string;
  action?: () => void;
  expandable?: boolean;
  upsellItems?: UpsellItem[];
  topSellers?: TopSellerItem[];
  shiftStats?: ShiftStats;
}

interface PenkeyPromptsBarProps {
  // Upsell data
  upsellSuggestions?: UpsellItem[];
  onSelectUpsellItem?: (item: UpsellItem, event?: React.MouseEvent) => void;
  triggerItem?: { id: string; name: string };
  
  // Stats data
  dailySales?: number;
  upsellCount?: number;
  itemsSold?: number;
  openTicketsCount?: number;
  topSellers?: TopSellerItem[];
  shiftStats?: ShiftStats;
  
  // Actions
  onOpenTickets?: () => void;
  onViewStats?: () => void;
  
  // Session info
  orgId?: string;
  memberId?: string;
  
  // Grid settings (to match main till page)
  gridSize?: 2 | 3 | 4 | 5 | 6;
  font_size?: "very_small" | "small" | "medium" | "large";
}

const MOTIVATIONAL_QUOTES = [
  "Every sale is a step towards success!",
  "You're doing amazing today! Keep it up!",
  "Great service = Happy customers!",
  "Smile! You're making someone's day!",
  "Small steps lead to big achievements!",
  "Your positive energy is contagious!",
  "Excellence is a habit, not an act!",
  "Today's effort is tomorrow's success!",
];

export function PenkeyPromptsBar({
  upsellSuggestions = [],
  onSelectUpsellItem,
  triggerItem,
  dailySales = 0,
  upsellCount = 0,
  itemsSold = 0,
  openTicketsCount = 0,
  topSellers = [],
  shiftStats,
  onOpenTickets,
  onViewStats,
  orgId,
  memberId,
  gridSize = 3,
  font_size = "medium",
}: PenkeyPromptsBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsing, setIsCollapsing] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Debug: Track when isExpanded changes
  useEffect(() => {
    console.log('[PromptsBar] 🔄 isExpanded changed to:', isExpanded);
  }, [isExpanded]);
  const [currentPrompt, setCurrentPrompt] = useState<PromptData | null>(null);
  const [promptRotationIndex, setPromptRotationIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [shouldBounce, setShouldBounce] = useState(false);
  const [shouldFlash, setShouldFlash] = useState(false);
  const [showBorder, setShowBorder] = useState(true);
  const barRef = useRef<HTMLDivElement>(null);
  const isCollapsingRef = useRef(false);
  const isExpandedRef = useRef(false);
  const collapsingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxDragHeight = window.innerHeight - 100; // Full screen minus bar height

  // Keep ref in sync with state
  useEffect(() => {
    isExpandedRef.current = isExpanded;
  }, [isExpanded]);

  // Listen for auto-collapse event - DISABLED for manual control
  // useEffect(() => {
  //   const handleCollapse = () => {
  //     if (isExpanded) {
  //       console.log('[PromptsBar] Auto-collapsing before prompt change');
  //       isCollapsingRef.current = true;
  //       setIsCollapsing(true);
  //       setIsExpanded(false);
  //       // Keep collapsing flag for 500ms during collapse animation
  //       setTimeout(() => {
  //         isCollapsingRef.current = false;
  //         setIsCollapsing(false);
  //       }, 500);
  //     }
  //   };
  //   window.addEventListener('penkey-prompts-collapse', handleCollapse);
  //   return () => window.removeEventListener('penkey-prompts-collapse', handleCollapse);
  // }, [isExpanded]);

  // Generate prompts based on available data
  const generatePrompts = (): PromptData[] => {
    const prompts: PromptData[] = [];

    // Upsell prompt (highest priority)
    if (upsellSuggestions.length > 0 && triggerItem) {
      // Create a list of item names for the subtext (only when collapsed)
      const itemNames = upsellSuggestions
        .slice(0, 3) // Show first 3 items
        .map(item => item.name)
        .join(', ');
      const moreCount = upsellSuggestions.length > 3 ? ` +${upsellSuggestions.length - 3} more` : '';
      
      prompts.push({
        type: 'upsell',
        icon: <Sparkles className="h-5 w-5" />,
        message: `Upsell with ${triggerItem.name}`,
        subtext: `${itemNames}${moreCount}`,
        expandable: true,
        upsellItems: upsellSuggestions,
      });
    }

    // Daily sales stat
    if (dailySales > 0) {
      prompts.push({
        type: 'stats',
        icon: <TrendingUp className="h-5 w-5" />,
        message: `${formatCurrency(dailySales)} taken today`,
        subtext: `${itemsSold} items sold`,
        action: onViewStats,
      });
    }

    // Upsell performance
    if (upsellCount > 0) {
      prompts.push({
        type: 'stats',
        icon: <Zap className="h-5 w-5" />,
        message: `${upsellCount} successful upsells today!`,
        subtext: 'Keep up the great work!',
        action: onViewStats,
      });
    }

    // Top Sellers Today (expandable)
    if (topSellers && topSellers.length > 0) {
      prompts.push({
        type: 'top-sellers',
        icon: <TrendingUp className="h-5 w-5" />,
        message: 'Top Sellers Today',
        subtext: `${topSellers.length} items flying off the shelf`,
        expandable: true,
        topSellers: topSellers,
      });
    }

    // Shift Summary (expandable)
    if (shiftStats && shiftStats.transactions > 0) {
      const hours = Math.floor(shiftStats.shift_duration_minutes / 60);
      const minutes = shiftStats.shift_duration_minutes % 60;
      const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      
      prompts.push({
        type: 'shift-summary',
        icon: <User className="h-5 w-5" />,
        message: 'Your Shift',
        subtext: `${duration} - ${formatCurrency(shiftStats.total_sales)} sales`,
        expandable: true,
        shiftStats: shiftStats,
      });
    }

    // Context-Aware Prompts (time-based, closes at 5pm)
    const hour = new Date().getHours();
    const minutes = new Date().getMinutes();
    
    if (hour >= 17) {
      // After 5pm: End of day summary
      prompts.push({
        type: 'context',
        icon: <Moon className="h-5 w-5" />,
        message: 'End of Day',
        subtext: dailySales > 0 
          ? `${formatCurrency(dailySales)} total - Close out & clean up`
          : 'Time to close out & clean up',
      });
    } else if (hour >= 6) {
      // During business hours
      if (hour < 11) {
        // Morning: Breakfast items
        prompts.push({
          type: 'context',
          icon: <Coffee className="h-5 w-5" />,
          message: 'Morning Rush',
          subtext: 'Suggest breakfast items & coffee',
        });
      } else if (hour < 14) {
        // Lunch: Meal deals
        prompts.push({
          type: 'context',
          icon: <Utensils className="h-5 w-5" />,
          message: 'Lunch Time',
          subtext: 'Promote meal deals & combos',
        });
      } else if (hour === 16 || (hour === 15 && minutes >= 30)) {
        // Closing soon (after 3:30pm)
        prompts.push({
          type: 'context',
          icon: <Clock className="h-5 w-5" />,
          message: 'Closing Soon',
          subtext: 'Last orders & closing prep',
        });
      }
    }

    // Motivational quote (always available as fallback)
    const randomQuote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
    prompts.push({
      type: 'motivation',
      icon: <Trophy className="h-5 w-5" />,
      message: randomQuote,
    });

    return prompts;
  };

  // Update current prompt when data changes
  useEffect(() => {
    console.log('[PromptsBar] 🔍 Effect triggered - dragOffset:', dragOffset, 'isCollapsing:', isCollapsing, 'upsellCount:', upsellSuggestions.length);
    
    // CRITICAL: Don't change prompts while bar is visually expanded OR collapsing
    // Simple rule: If dragOffset > 0, bar is up, don't change prompts!
    // Also block during collapsing state to prevent immediate prompt change
    if (dragOffset > 0 || isCollapsing) {
      console.log('[PromptsBar] ⛔ BLOCKED prompt update - bar expanded or collapsing (dragOffset:', dragOffset, 'isCollapsing:', isCollapsing, ')');
      return;
    }
    console.log('[PromptsBar] ✅ Running prompt update effect');
    
    const prompts = generatePrompts();
    if (prompts.length > 0) {
      const upsellPrompt = prompts.find(p => p.type === 'upsell');
      
      // **PRIORITY LOGIC**: Upsell prompts ALWAYS take priority
      if (upsellPrompt) {
        // Only update if message changed to avoid unnecessary re-renders
        if (currentPrompt?.message !== upsellPrompt.message) {
          console.log('[PromptsBar] ✨ PRIORITIZING upsell prompt:', upsellPrompt.message);
          setCurrentPrompt(upsellPrompt);
          setPromptRotationIndex(0); // Reset rotation
          
          // Show animations if NOT expanded
          if (!isExpanded) {
            setShouldBounce(true);
            setShouldFlash(true);
            setShowBorder(true);
            hapticButtonPress();
            setTimeout(() => {
              setShouldBounce(false);
              setShouldFlash(false);
              setShowBorder(false);
            }, 600);
          }
        }
      } else if (!currentPrompt || currentPrompt.type === 'upsell') {
        // No upsell available, show first non-upsell prompt
        const nextPrompt = prompts[0];
        if (currentPrompt?.message !== nextPrompt?.message) {
          console.log('[PromptsBar] 🔄 Rotating to prompt:', nextPrompt?.message);
          setCurrentPrompt(nextPrompt);
          
          // Show animations if NOT expanded
          if (!isExpanded) {
            setShouldFlash(true);
            setShowBorder(true);
            hapticButtonPress();
            setTimeout(() => {
              setShouldFlash(false);
              setShowBorder(false);
            }, 600);
          }
        }
      }
    }
  }, [upsellSuggestions.length, triggerItem?.id, dailySales, upsellCount, openTicketsCount]);

  // Rotate through ALL prompts every 15 seconds (including upsells and stats)
  useEffect(() => {
    // Don't set up rotation if expanded or collapsing
    if (isExpanded || isCollapsingRef.current) {
      console.log('[PromptsBar] Rotation disabled - expanded or collapsing');
      return;
    }

    const allPrompts = generatePrompts();
    if (allPrompts.length <= 1) return; // Need at least 2 prompts to rotate

    const interval = setInterval(() => {
      // Don't rotate if expanded or collapsing
      if (isExpandedRef.current || isCollapsingRef.current) {
        console.log('[PromptsBar] ⏭️ Skipped rotation tick - expanded:', isExpandedRef.current, 'collapsing:', isCollapsingRef.current);
        return;
      }
      
      // Rotate through all prompts (upsells AND stats)
      const nextIndex = (promptRotationIndex + 1) % allPrompts.length;
      const nextPrompt = allPrompts[nextIndex];
      console.log('[PromptsBar] ⏰ 15s rotation to:', nextPrompt?.message, `(${nextIndex + 1}/${allPrompts.length})`);
      setPromptRotationIndex(nextIndex);
      setCurrentPrompt(nextPrompt);
    }, 15000); // Rotate every 15 seconds

    return () => clearInterval(interval);
  }, [promptRotationIndex, currentPrompt?.type, upsellSuggestions.length, triggerItem?.id, dailySales, upsellCount, openTicketsCount]);

  const handleTouchStart = (e: React.TouchEvent) => {
    // Allow dragging if:
    // 1. There's expandable content (to expand)
    // 2. Already expanded (to collapse)
    if (!currentPrompt?.expandable || upsellSuggestions.length === 0) {
      if (!isExpanded) return; // Can't drag if not expandable and not expanded
    }
    
    const touch = e.touches[0];
    setTouchStart({
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    });
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || !isDragging) return;
    
    const touch = e.touches[0];
    const deltaY = touch.clientY - touchStart.y;
    
    // Calculate new offset based on current position and drag delta
    let newOffset;
    
    if (isExpanded) {
      // When expanded, dragging down reduces offset from maxDragHeight
      newOffset = Math.max(0, Math.min(maxDragHeight, maxDragHeight - deltaY));
    } else {
      // When collapsed, dragging up increases offset from 0
      newOffset = Math.max(0, Math.min(maxDragHeight, -deltaY));
    }
    
    setDragOffset(newOffset);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    const deltaTime = Date.now() - touchStart.time;
    const velocity = Math.abs(deltaY) / deltaTime;
    
    setIsDragging(false);
    
    // Tap to toggle (expand when collapsed, collapse when expanded)
    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      if (currentPrompt?.type === 'stats') {
        hapticButtonPress(); // Haptic on stats tap
      }
      handleBarClick();
      // Don't set dragOffset here - let handleBarClick animation handle it
    }
    // Determine if should expand or collapse based on drag distance
    else if (Math.abs(deltaY) > 10) {
      // Dragged up more than 100px or fast flick up - expand
      if ((deltaY < -100 || (deltaY < -50 && velocity > 0.5)) && !isExpanded) {
        hapticButtonPress();
        setIsExpanded(true);
        setDragOffset(maxDragHeight);
      }
      // Dragged down more than 100px or fast flick down - collapse
      else if ((deltaY > 100 || (deltaY > 50 && velocity > 0.5)) && isExpanded) {
        hapticButtonPress();
        
        isCollapsingRef.current = true;
        setIsCollapsing(true);
        setIsExpanded(false);
        setDragOffset(0);
        
        // Don't clear suggestions - just collapse the bar
        // Suggestions should persist as long as items are in cart
        
        setTimeout(() => {
          isCollapsingRef.current = false;
          setIsCollapsing(false);
        }, 500);
      }
      // Snap to nearest state based on current position (only for actual drags)
      else if (dragOffset > maxDragHeight / 2) {
        hapticButtonPress(); // Haptic on snap
        setIsExpanded(true);
        setDragOffset(maxDragHeight);
      } else if (dragOffset > 0) {
        // Only snap to closed if we actually dragged (dragOffset > 0)
        hapticButtonPress(); // Haptic on snap
        
        isCollapsingRef.current = true;
        setIsCollapsing(true);
        setIsExpanded(false);
        setDragOffset(0);
        
        // Don't clear suggestions - just collapse the bar
        // Suggestions should persist as long as items are in cart
        
        setTimeout(() => {
          isCollapsingRef.current = false;
          setIsCollapsing(false);
        }, 500);
      }
    }
    
    setTouchStart(null);
  };

  const handleBarClick = () => {
    console.log('[PromptsBar] 👆 Bar clicked - current isExpanded:', isExpanded, 'suggestions:', upsellSuggestions.length);
    if (!currentPrompt) return;
    
    // Don't allow expanding if no suggestions
    if (currentPrompt?.expandable && upsellSuggestions.length === 0 && !isExpanded) {
      console.log('[PromptsBar] ⛔ Cannot expand - no suggestions');
      return;
    }
    
    if (currentPrompt?.expandable && (upsellSuggestions.length > 0 || isExpanded)) {
      const newExpanded = !isExpanded;
      console.log('[PromptsBar] 🎯 Toggling expanded from', isExpanded, 'to', newExpanded);
      setIsExpanded(newExpanded);
      setIsAnimating(true); // Block clicks during animation
      
      // Smooth drag-like animation
      if (newExpanded) {
        // Expand animation - smooth easing
        let progress = 0;
        const duration = 400; // ms
        const startTime = Date.now();
        const animate = () => {
          const elapsed = Date.now() - startTime;
          progress = Math.min(elapsed / duration, 1);
          // Ease out cubic for smooth deceleration
          const eased = 1 - Math.pow(1 - progress, 3);
          setDragOffset(eased * maxDragHeight);
          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            setDragOffset(maxDragHeight);
            setIsAnimating(false); // Allow clicks after animation
          }
        };
        requestAnimationFrame(animate);
      } else {
        // Collapse animation - smooth easing
        let progress = 0;
        const duration = 400; // ms
        const startTime = Date.now();
        const animate = () => {
          const elapsed = Date.now() - startTime;
          progress = Math.min(elapsed / duration, 1);
          // Ease out cubic for smooth deceleration
          const eased = 1 - Math.pow(1 - progress, 3);
          setDragOffset((1 - eased) * maxDragHeight);
          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            setDragOffset(0);
            setIsAnimating(false); // Allow clicks after animation
          }
        };
        requestAnimationFrame(animate);
      }
    } else if (currentPrompt?.action) {
      currentPrompt.action();
    }
  };

  const handleUpsellItemClick = (item: UpsellItem, event: React.MouseEvent) => {
    // Prevent clicks during animation
    if (isAnimating) {
      console.log('[PromptsBar] ⛔ Click blocked - animation in progress');
      return;
    }
    
    console.log('[PromptsBar] 🛒 Upsell item clicked:', item.name);
    
    hapticItemAdded();
    if (onSelectUpsellItem) {
      onSelectUpsellItem(item, event);
    }
  };

  if (!currentPrompt) return null;

  const getPromptStyles = () => {
    // All prompts use same grey background as button tiles
    let styles = 'bg-[#3d3d3d]';
    
    // Upsell prompts get orange border (fades after flash)
    if (currentPrompt.type === 'upsell') {
      styles += ' border-2';
      styles += showBorder ? ' border-penkey-orange' : ' border-transparent';
      styles += ' transition-colors duration-500'; // Smooth fade
      if (shouldBounce) {
        styles += ' animate-bounce-in';
      }
    } else {
      styles += ' border-t border-gray-700';
    }
    
    return styles;
  };

  // Calculate expansion height based on drag
  const expansionHeight = isExpanded ? maxDragHeight : dragOffset;
  const expandProgress = expansionHeight / maxDragHeight;
  
  return (
    <>
      {/* Backdrop when expanded - full screen like reports modal */}
      {expansionHeight > 0 && (
        <div 
          className={`fixed inset-0 bg-black/70 z-10 transition-opacity duration-300 ${
            isExpanded ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => {
            isCollapsingRef.current = true;
            setIsCollapsing(true);
            setIsExpanded(false);
            setDragOffset(0);
            
            setTimeout(() => {
              isCollapsingRef.current = false;
              setIsCollapsing(false);
            }, 300);
          }}
        />
      )}
      
      {/* Combined container - bar + expansion as one unit */}
      <div 
        ref={barRef}
        className="fixed left-0 right-0 z-30"
        style={{
          bottom: 0,
          transition: isDragging ? 'none' : 'bottom 0.3s ease-out',
        }}
      >
        {/* Expandable Upsell Items Section - Above the bar */}
        {expansionHeight > 0 && currentPrompt.expandable && upsellSuggestions.length > 0 && (
          <div 
            className="bg-[#3d3d3d] overflow-hidden rounded-t-3xl sm:rounded-xl"
            style={{
              height: `${expansionHeight}px`,
              borderLeft: showBorder ? '2px solid rgb(249, 115, 22)' : '2px solid transparent',
              borderRight: showBorder ? '2px solid rgb(249, 115, 22)' : '2px solid transparent',
              borderBottom: showBorder ? '2px solid rgb(249, 115, 22)' : '2px solid transparent',
              borderTop: 'none',
              transitionProperty: 'height, border-left-color, border-right-color, border-bottom-color',
              transitionDuration: isDragging ? '0s' : '0.3s, 0.5s, 0.5s, 0.5s',
            }}
          >
            <div 
              className={`p-3 grid gap-2 max-h-[50vh] overflow-y-auto ${
                gridSize === 2 ? 'grid-cols-2' :
                gridSize === 3 ? 'grid-cols-3' :
                gridSize === 4 ? 'grid-cols-4' :
                gridSize === 5 ? 'grid-cols-5' :
                'grid-cols-6'
              }`}
              style={{
                transition: 'all 0.3s ease-out',
              }}
              onTouchStart={() => {
                console.log('[PromptsBar] User touching grid');
              }}
              onScroll={() => {
                console.log('[PromptsBar] User scrolling grid');
              }}
            >
              {upsellSuggestions.map((item) => {
                const price = item.has_variants
                  ? item.item_variants?.[0]?.price || 0
                  : item.base_price || 0;
                const hasImage = item.image_url;

                return (
                  <button
                    key={item.id}
                    onClick={(e) => handleUpsellItemClick(item, e)}
                    className="relative rounded-lg overflow-hidden transition-all duration-300 ease-out aspect-square bg-[#5d5d5d] active:bg-penkey-orange active:scale-95"
                    style={{
                      opacity: isAnimating ? 0.5 : 1,
                      pointerEvents: isAnimating ? 'none' : 'auto',
                    }}
                  >
                    {/* Image Background */}
                    {hasImage && (
                      <img 
                        src={item.image_url!} 
                        alt={item.name}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                    
                    {/* Text Overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-2 bg-black/40">
                      <p className="text-white text-xs font-medium text-center leading-tight line-clamp-2">
                        {item.name}
                      </p>
                      {price > 0 && (
                        <p className="text-white text-xs mt-1 font-semibold">
                          {formatCurrency(price)}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Fixed Prompt Bar - 10px thicker (74px) */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleBarClick}
          className={`w-full ${getPromptStyles()} text-white px-4 flex items-center justify-between transition-colors duration-200 active:brightness-110 cursor-pointer touch-none`}
          style={{
            height: '74px',
            animation: shouldFlash ? 'quickFlash 0.6s ease-out' : 'none',
            borderTopLeftRadius: expansionHeight > 0 ? '0' : '12px',
            borderTopRightRadius: expansionHeight > 0 ? '0' : '12px',
            boxShadow: expansionHeight > 0 ? 'none' : '0 -2px 10px rgba(0,0,0,0.3)',
          }}
        >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0">
            {currentPrompt.icon}
          </div>
          <div className="flex-1 text-center min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">
              {currentPrompt.message}
            </p>
            {currentPrompt.subtext && !isExpanded && (
              <p className="text-xs opacity-90 mt-0.5 truncate">
                {currentPrompt.subtext}
              </p>
            )}
          </div>
        </div>
        {currentPrompt.expandable && (
          <div className="flex-shrink-0 ml-2">
            {isExpanded ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronUp className="h-5 w-5" />
            )}
          </div>
        )}
      </div>
      </div>
    </>
  );
}
