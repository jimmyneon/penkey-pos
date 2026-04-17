"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@penkey/ui";
import { ShoppingCart, User, LogOut, Menu, Plus, Minus, X, Package, Percent, Archive, Trash2, MoreHorizontal, Grid3x3, List, Settings, FileText, Save, Search, Tag, Star } from "lucide-react";
import { useCategories } from "@/lib/hooks/use-categories";
import { useItems } from "@/lib/hooks/use-items";
import { usePopularItems } from "@/lib/hooks/use-popular-items";
import { useCartStore } from "@/lib/store/cart-store";
import { useDataSync } from "@/lib/hooks/use-data-sync";
import { useModifierPreload } from "@/lib/hooks/use-modifier-preload";
import { useSessionManager } from "@/lib/hooks/use-session-manager";
import { formatCurrency } from "@penkey/ui";
import { VariantDialog } from "./variant-dialog";
import { ModifierDialog } from "./modifier-dialog";
import { TicketModal } from "./ticket-modal";
import { SidebarMenu } from "./sidebar-menu";
import { ProfileMenu } from "./profile-menu";
import { TicketActionsMenu } from "./ticket-actions-menu";
import { SaveTicketDialog } from "./save-ticket-dialog";
import { OpenTicketsDialog } from "./open-tickets-dialog";
import { PriceInputDialog } from "./price-input-dialog";
import { CategorySelectorDialog } from "./category-selector-dialog";
import { AssignTicketDialog } from "./assign-ticket-dialog";
// import { EnhancedAssignTicketDialog } from "./enhanced-assign-ticket-dialog"; // TODO: Fix perks integration
import { MergeTicketsDialog } from "./merge-tickets-dialog";
import { SplitTicketDialog } from "./split-ticket-dialog";
import { PenkeyPromptsBar } from "./penkey-prompts-bar";
import { ItemsDisplay } from "./items-display";
import { SellHeader } from "./sell-header";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { hapticButtonPress, hapticItemAdded, hapticDelete, hapticSuccess, setHapticEnabledCheck } from "@/lib/utils/haptics";
import { playButtonSound, playItemAddedSound, playDeleteSound, playSuccessSound, playErrorSound, playPaymentInitSound, setSoundEnabledCheck } from "@/lib/utils/sounds";
import { useToast } from "@/lib/hooks/use-toast";
import { ToastContainer } from "@/components/toast-container";
import { upsellLearningEngine } from "@/lib/services/upsell-learning-engine";
import { useRegisterSettings } from "@/lib/hooks/use-register-settings";
import { getAll, getByKey } from "@/lib/idb/db";
import { modifierRAMCache } from "@/lib/services/modifier-ram-cache";
import { OutboxSyncService } from "@/lib/services/outbox-sync";
import { CartSyncService } from "@/lib/services/cart-sync";
import { TicketSyncService } from "@/lib/services/ticket-sync";

interface Session {
  employee: {
    id: string;
    name: string;
    role: string;
  };
  register: {
    id: string;
    name: string;
    store_name: string;
  };
  org_id: string;
}

export default function SellPage() {
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Load register settings with realtime sync
  const { settings: registerSettingsData, updateSetting: updateRegisterSetting } = useRegisterSettings(session?.register?.id);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [showPopular, setShowPopular] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('showPopular');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [showFavourites, setShowFavourites] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('showFavourites');
      return saved === 'true';
    }
    return false;
  });
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [modifierDialogOpen, setModifierDialogOpen] = useState(false);
  const [pendingItemEvent, setPendingItemEvent] = useState<React.MouseEvent | null>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [ticketActionsOpen, setTicketActionsOpen] = useState(false);
  const [saveTicketOpen, setSaveTicketOpen] = useState(false);
  const [openTicketsOpen, setOpenTicketsOpen] = useState(false);
  const [priceInputOpen, setPriceInputOpen] = useState(false);
  const [categorySelectorOpen, setCategorySelectorOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [assignTicketOpen, setAssignTicketOpen] = useState(false);
  const [mergeTicketsOpen, setMergeTicketsOpen] = useState(false);
  const [splitTicketOpen, setSplitTicketOpen] = useState(false);
  const [ticketAssignment, setTicketAssignment] = useState<{ type: 'customer' | 'table'; name: string; customer?: any } | null>(null);
  const [currentTicketName, setCurrentTicketName] = useState<string>("");
  const [currentTicketComment, setCurrentTicketComment] = useState<string>("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [layout, setLayout] = useState<"grid" | "list">(registerSettingsData.layout_preference);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [savedTickets, setSavedTickets] = useState<any[]>([]);
  const [clickedItemId, setClickedItemId] = useState<string | null>(null);
  const [flyingItem, setFlyingItem] = useState<{ x: number; y: number; name: string } | null>(null);
  const [flyingTicket, setFlyingTicket] = useState<{ x: number; y: number; name: string } | null>(null);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [upsellSuggestions, setUpsellSuggestions] = useState<any[]>([]);
  const [upsellTriggerItem, setUpsellTriggerItem] = useState<{ id: string; name: string } | null>(null);
  const [upsellDebounceTimer, setUpsellDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [upsellResetTimer, setUpsellResetTimer] = useState<NodeJS.Timeout | null>(null);
  const [isSelectingFromUpsell, setIsSelectingFromUpsell] = useState(false);

  // Sync layout from settings
  useEffect(() => {
    setLayout(registerSettingsData.layout_preference);
  }, [registerSettingsData.layout_preference]);

  // Apply theme and font size to document
  useEffect(() => {
    // Apply theme
    if (registerSettingsData.theme === "light") {
      document.documentElement.classList.add("light-theme");
    } else {
      document.documentElement.classList.remove("light-theme");
    }

    // Apply font size
    document.documentElement.setAttribute("data-font-size", registerSettingsData.font_size);

    // Set haptic feedback check
    setHapticEnabledCheck(() => registerSettingsData.haptic_enabled);
    // Set sound effects check
    setSoundEnabledCheck(() => registerSettingsData.sound_enabled);
  }, [registerSettingsData.theme, registerSettingsData.font_size, registerSettingsData.haptic_enabled, registerSettingsData.sound_enabled]);

  // Load saved tickets from database
  useEffect(() => {
    if (!session) return;

    const loadTickets = async () => {
      try {
        // First, migrate any existing localStorage tickets
        const migrated = await TicketSyncService.migrateLocalTickets(
          session.org_id,
          session.register.id,
          session.employee.id
        );
        if (migrated > 0) {
          console.log(`[Tickets] Migrated ${migrated} tickets from localStorage`);
        }

        // Load all tickets from database
        const tickets = await TicketSyncService.loadTickets(session.org_id);
        setSavedTickets(tickets);
      } catch (error) {
        console.error('[Tickets] Failed to load:', error);
      }
    };

    loadTickets();
  }, [session]);

  // Periodic background sync every 15 seconds — sync pending + reset failed items
  useEffect(() => {
    if (!session) return;

    const syncInterval = setInterval(async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          // Retry any permanently-failed items before normal sync
          const { failed } = await OutboxSyncService.getOutboxCount();
          if (failed > 0) {
            console.log(`[Sell] Resetting ${failed} failed outbox items to retry`);
            await OutboxSyncService.retryFailed();
          } else {
            await OutboxSyncService.syncOutbox();
          }
        } catch (err) {
          console.error('[Sell] Background sync failed:', err);
        }
      }
    }, 15000); // 15 seconds

    return () => clearInterval(syncInterval);
  }, [session]);

  const toggleLayout = async () => {
    const newLayout = layout === "grid" ? "list" : "grid";
    setLayout(newLayout);
    
    try {
      await updateRegisterSetting("layout_preference", newLayout);
      console.log("[Sell] Layout preference saved:", newLayout);
    } catch (error) {
      console.error("[Sell] Failed to save layout preference:", error);
    }
  };

  const { categories } = useCategories(session?.org_id || "skip", forceRefresh);
  const { items, loading: itemsLoading } = useItems(
    session?.org_id || "skip", 
    selectedCategory, 
    forceRefresh
  );
  const { items: popularItems, loading: popularLoading } = usePopularItems(session?.org_id || "skip", forceRefresh);
  const { syncing, lastSync, syncData, getCacheInfo } = useDataSync(session?.org_id || "skip");
  const { lines, addLine, updateQuantity, removeLine, getSubtotal, getTaxTotal, getTotal, clearCart, loadLines } = useCartStore();
  
  // Session management - handles inactivity timeout and page visibility
  useSessionManager();

  // Determine which items to show based on selected category and popular filter
  // When Popular is ON: show ALL items (from category if selected), sorted by popularity
  // When Popular is OFF: show regular category items
  const displayItems = items;
  const displayLoading = itemsLoading || popularLoading;

  // Preload modifiers for all items into RAM cache
  // Memoize itemIds to prevent unnecessary preload triggers on every render
  const memoizedItemIds = useMemo(() => items.map(item => item.id), [items]);
  useModifierPreload(memoizedItemIds);

  // Initialize upsell learning engine when items are loaded
  useEffect(() => {
    if (items.length > 0 && !upsellLearningEngine.isReady()) {
      upsellLearningEngine.initialize(items, session?.org_id, categories);
      // Load learned associations from cache/API
      if (session?.org_id) {
        upsellLearningEngine.loadAssociations(session.org_id, forceRefresh);
      }
    }
  }, [items, categories, session, forceRefresh]);

  // Update upsell suggestions when cart changes (dynamic filtering)
  useEffect(() => {
    if (upsellTriggerItem && upsellLearningEngine.isReady() && upsellSuggestions.length > 0) {
      // Recalculate to filter out items now in cart
      const triggerItem = items.find(i => i.id === upsellTriggerItem.id);
      if (triggerItem) {
        const updatedSuggestions = upsellLearningEngine.getSuggestions(triggerItem, lines, 4);
        if (updatedSuggestions.length !== upsellSuggestions.length) {
          setUpsellSuggestions(updatedSuggestions);
        }
      }
    }
  }, [lines.length, upsellTriggerItem, items]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (upsellDebounceTimer) {
        clearTimeout(upsellDebounceTimer);
      }
      if (upsellResetTimer) {
        clearTimeout(upsellResetTimer);
      }
    };
  }, [upsellDebounceTimer, upsellResetTimer]);

  // Persist filter states to localStorage
  useEffect(() => {
    localStorage.setItem('showPopular', showPopular.toString());
  }, [showPopular]);

  useEffect(() => {
    localStorage.setItem('showFavourites', showFavourites.toString());
  }, [showFavourites]);

  // Filter and sort items by search query and popularity
  const searchLower = searchQuery.toLowerCase();
  
  // Always filter by contains (consistent behavior for all query lengths)
  let filteredItems = displayItems.filter((item) => {
    return item.name.toLowerCase().includes(searchLower);
  });

  // Intelligent search ranking: favourites > favourite_position > popularity > alphabetical
  // Create popularity map for ranking
  const popularityMap = new Map<string, number>();
  popularItems.forEach((item, index) => {
    popularityMap.set(item.id, index);
  });

  filteredItems = filteredItems.sort((a, b) => {
    // First priority: is_favourite (favourites come first)
    const aFav = (a as any).is_favourite ? 0 : 1;
    const bFav = (b as any).is_favourite ? 0 : 1;
    if (aFav !== bFav) return aFav - bFav;

    // Second priority: favourite_position (for favourites only)
    if (aFav === 0 && bFav === 0) {
      const aPos = (a as any).favourite_position ?? 9999;
      const bPos = (b as any).favourite_position ?? 9999;
      if (aPos !== bPos) return aPos - bPos;
    }

    // Third priority: popularity (lower rank = more popular)
    const aRank = popularityMap.get(a.id) ?? 9999;
    const bRank = popularityMap.get(b.id) ?? 9999;
    if (aRank !== bRank) return aRank - bRank;

    // Fourth priority: alphabetical
    return a.name.localeCompare(b.name);
  });

  // If Popular filter is ON, filter to show only popular items
  if (showPopular && popularItems.length > 0) {
    filteredItems = filteredItems.filter(item => popularityMap.has(item.id));
  }

  // If Favourites filter is ON, filter to show only favourite items
  if (showFavourites) {
    filteredItems = filteredItems.filter(item => (item as any).is_favourite === true);
  }

  useEffect(() => {
    // Check for valid session
    const sessionData = sessionStorage.getItem("pos_session");
    console.log("[SellPage] Session data from storage:", sessionData);
    if (!sessionData) {
      router.push("/lock");
      return;
    }

    try {
      const parsed = JSON.parse(sessionData);
      console.log("[SellPage] Parsed session:", parsed);
      console.log("[SellPage] org_id:", parsed.org_id);
      setSession(parsed);
    } catch (err) {
      console.error("[SellPage] Failed to parse session:", err);
      router.push("/lock");
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Initialize cart sync when session is loaded - LOAD ONLY, no polling
  useEffect(() => {
    if (!session) return;

    const initCartSync = async () => {
      try {
        // Load cart from database ONCE on mount
        const { lines: syncedLines, ticketAssignment: syncedAssignment} = await CartSyncService.initialize(
          session.org_id,
          session.register.id,
          session.employee.id
        );

        // If we have synced data and local cart is empty, load it
        if (syncedLines.length > 0 && lines.length === 0) {
          loadLines(syncedLines);
          if (syncedAssignment) {
            setTicketAssignment(syncedAssignment);
          }
          console.log('[CartSync] Loaded cart from database on mount');
        }

        // DO NOT start polling - causes sync loops
        // Multi-device sync will happen via page refresh
      } catch (error) {
        console.error('[CartSync] Failed to initialize:', error);
      }
    };

    initCartSync();
  }, [session]);

  // Sync cart to database in background (write-only, no read)
  useEffect(() => {
    if (!session || lines.length === 0) return;
    
    // Debounce to avoid too many writes
    const timer = setTimeout(() => {
      CartSyncService.saveCart(lines, ticketAssignment);
    }, 1000); // Increased debounce to 1 second

    return () => clearTimeout(timer);
  }, [lines, ticketAssignment, session]);

  // Auto-sync data after PIN entry (when session is first loaded)
  // Removed auto-sync - data hooks now handle smart caching with SyncManager
  // Data loads instantly from IndexedDB and syncs in background only if stale

  // Listen for manual collapse to clear suggestions
  useEffect(() => {
    const handleClearSuggestions = () => {
      console.log('[Upsell] Clearing suggestions - user manually collapsed');
      setUpsellSuggestions([]);
      setUpsellTriggerItem(null);
      setIsSelectingFromUpsell(false);
    };
    
    window.addEventListener('clear-upsell-suggestions', handleClearSuggestions);
    return () => window.removeEventListener('clear-upsell-suggestions', handleClearSuggestions);
  }, []);

  const triggerFlyingAnimation = (itemName: string, event: React.MouseEvent) => {
    console.log('[Fly Animation] triggerFlyingAnimation called for:', itemName);
    const button = event.currentTarget as HTMLElement;
    console.log('[Fly Animation] Button element:', button);
    if (!button) {
      console.log('[Fly Animation] No button element found');
      return; // Guard against null button
    }
    
    const animateItemToTicket = (itemName: string, buttonRect: DOMRect) => {
    const ticketIndicator = document.querySelector('[data-ticket-indicator]');
    console.log('[Fly Animation] Ticket indicator:', ticketIndicator);
    
    if (!ticketIndicator) {
      console.log('[Fly Animation] No ticket indicator found');
      return;
    }
    
    const ticketRect = ticketIndicator.getBoundingClientRect();
    
    // Create flying element
    const flyingEl = document.createElement('div');
    flyingEl.textContent = itemName;
    flyingEl.style.cssText = `
      position: fixed;
      left: ${buttonRect.left + buttonRect.width / 2}px;
      top: ${buttonRect.top + buttonRect.height / 2}px;
      background: #f97316;
      color: white;
      padding: 12px 20px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 16px;
      pointer-events: none;
      z-index: 9999;
      transform: translate(-50%, -50%) scale(1);
      transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      box-shadow: 0 8px 24px rgba(249, 115, 22, 0.4);
    `;
    
    document.body.appendChild(flyingEl);
    
    // Animate ticket catch
    const ticketEl = ticketIndicator as HTMLElement;
    ticketEl.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    
    // Force reflow to ensure initial state is rendered
    flyingEl.offsetHeight;
    
    // Trigger animation INSTANTLY - no setTimeout at all
    flyingEl.style.left = `${ticketRect.left + ticketRect.width / 2}px`;
    flyingEl.style.top = `${ticketRect.top + ticketRect.height / 2}px`;
    flyingEl.style.opacity = '0';
    flyingEl.style.transform = 'translate(-50%, -50%) scale(0.2)';
    
    // Ticket catches it - expand slightly
    setTimeout(() => {
      ticketEl.style.transform = 'scale(1.15)';
    }, 300);
    
    // Ticket returns to normal
    setTimeout(() => {
      ticketEl.style.transform = 'scale(1)';
    }, 500);
    
    // Remove element after animation
    setTimeout(() => {
      document.body.removeChild(flyingEl);
    }, 600);
  };
    
    const buttonRect = button.getBoundingClientRect();
    animateItemToTicket(itemName, buttonRect);
  };

  const handleAddItem = (item: any, event?: React.MouseEvent) => {
    console.log('[handleAddItem] Called for item:', item.name, 'with event:', !!event);
    // Trigger button press animation and haptic feedback
    hapticButtonPress();
    playButtonSound();
    setClickedItemId(item.id);
    setTimeout(() => setClickedItemId(null), 200);

    setSelectedItem(item);

    // Check if item has a price
    const price = item.has_variants 
      ? (item.item_variants?.[0]?.price || null)
      : item.base_price;

    if (!price) {
      // Show price input dialog
      setPriceInputOpen(true);
      return;
    }

    // If item has variants, show variant dialog first
    if (item.has_variants && item.item_variants?.length > 0) {
      setPendingItemEvent(event || null);
      setVariantDialogOpen(true);
      return;
    }

    // Check if item has modifiers - show modifier dialog
    console.log('[handleAddItem] Calling checkAndShowModifiers with event:', !!event);
    checkAndShowModifiers(item, null, event);
  };

  const checkAndShowModifiers = async (item: any, variant: any, event?: React.MouseEvent) => {
    console.log('[checkAndShowModifiers] Called for item:', item.name, 'with event:', !!event);
    try {
      // 1) RAM cache — O(1), synchronous, no awaits
      const ramGroups = modifierRAMCache.get(item.id);
      console.log('[checkAndShowModifiers] RAM cache groups:', ramGroups);
      if (ramGroups !== null) {
        if (ramGroups && ramGroups.length > 0) {
          console.log('[checkAndShowModifiers] Showing modifier dialog');
          setSelectedItem(item);
          setSelectedVariant(variant);
          setModifierDialogOpen(true);
        } else {
          // Confirmed no modifiers — add directly (same path as the fallback below)
          console.log('[checkAndShowModifiers] RAM cache empty, adding directly with event:', !!event);
          const price = variant ? variant.price : item.base_price;
          addLine({ item_id: item.id, item_name: item.name, variant_id: variant?.id || null, variant_name: variant?.name || null, quantity: 1, unit_price: price, modifiers: [], notes: "", tax_rate: 0 });
          if (event) {
            console.log('[checkAndShowModifiers] Triggering animation from RAM cache path');
            triggerFlyingAnimation(item.name, event);
          }
          debouncedUpsellSuggestions(item);
          setSelectedItem(null);
        }
        return;
      }

      // 2) item_modifier_groups IDB key (single keyed lookup, no full-table scan)
      try {
        const row: any = await getByKey('item_modifier_groups', item.id as any);
        if (row) {
          const hasGroups = row.groups?.some((g: any) => g?.modifier_options?.length > 0);
          if (hasGroups) {
            console.log('[checkAndShowModifiers] IDB has groups, showing modifier dialog');
            setSelectedItem(item);
            setSelectedVariant(variant);
            setModifierDialogOpen(true);
            return;
          } else {
            console.log('[checkAndShowModifiers] IDB has empty groups, adding directly with event:', !!event);
            modifierRAMCache.set(item.id, []);
            const price = variant ? variant.price : item.base_price;
            addLine({ item_id: item.id, item_name: item.name, variant_id: variant?.id || null, variant_name: variant?.name || null, quantity: 1, unit_price: price, modifiers: [], notes: "", tax_rate: 0 });
            if (event) {
              console.log('[checkAndShowModifiers] Triggering animation from IDB path');
              triggerFlyingAnimation(item.name, event);
            }
            debouncedUpsellSuggestions(item);
            setSelectedItem(null);
            return;
          }
        }
      } catch {}

      // 3) API fallback (first-time, not yet prefetched)
      if (navigator.onLine) {
        const response = await fetch(`/api/items/${item.id}/modifiers`);
        if (response.ok) {
          const modifiers = await response.json();
          if (modifiers && modifiers.length > 0) {
            setSelectedItem(item);
            setSelectedVariant(variant);
            setModifierDialogOpen(true);
            return;
          }
        }
      }
    } catch (err) {
      console.error("Failed to check modifiers:", err);
    }

    // No modifiers - add directly to cart
    console.log('[checkAndShowModifiers] No modifiers found, adding directly to cart. Event:', !!event);
    const price = variant ? variant.price : item.base_price;
    
    addLine({
      item_id: item.id,
      item_name: item.name,
      variant_id: variant?.id || null,
      variant_name: variant?.name || null,
      quantity: 1,
      unit_price: price,
      modifiers: [],
      notes: "",
      tax_rate: 0, // Prices already include VAT
    });

    // Trigger flying animation (if we have an event)
    if (event) {
      console.log('[Fly Animation] Triggering for item without modifiers:', item.name);
      triggerFlyingAnimation(item.name, event);
    } else {
      console.log('[Fly Animation] No event available for item without modifiers:', item.name);
    }

    // Debounced upsell
    debouncedUpsellSuggestions(item);

    // Reset state
    setSelectedItem(null);
  };

  const debouncedUpsellSuggestions = (item: any) => {
    // Clear existing timer
    if (upsellDebounceTimer) {
      clearTimeout(upsellDebounceTimer);
    }

    // Set new timer - wait 300ms after last item add (instant feel for busy cafe)
    const timer = setTimeout(() => {
      getInstantUpsellSuggestions(item);
    }, 300);

    setUpsellDebounceTimer(timer);
  };

  const getInstantUpsellSuggestions = (item: any) => {
    // Check if upsells are enabled in settings
    if (!registerSettingsData.penkey_prompts_enabled) {
      console.log("[Upsell] Disabled by user settings");
      return;
    }

    // Check if engine is ready
    if (!upsellLearningEngine.isReady()) {
      console.log("[Upsell] Learning engine not ready yet");
      return;
    }

    // Don't calculate upsells if we're selecting from upsell panel
    if (isSelectingFromUpsell) {
      console.log('[Upsell] Skipped calculation - selecting from panel');
      return;
    }

    // Debounce upsell calculation
    if (upsellDebounceTimer) {
      clearTimeout(upsellDebounceTimer);
    }

    const timer = setTimeout(async () => {
      try {
        const triggerItem = item;
        setUpsellTriggerItem({ id: triggerItem.id, name: triggerItem.name });

        const suggestions = upsellLearningEngine.getSuggestions(triggerItem, lines, 8);
    
        // Debug: Log what we got from learning engine
        console.log('[Upsell] Raw suggestions from engine:', suggestions.map(s => `${s.name} (${s.id})`));
        
        // Remove duplicates by item NAME (not ID) since database has duplicate items
        const uniqueSuggestions = suggestions.filter((item, index, self) =>
          index === self.findIndex((t) => t.name === item.name)
        );

        // Log if duplicates were found
        if (suggestions.length !== uniqueSuggestions.length) {
          console.warn(`[Upsell] ⚠️ Removed ${suggestions.length - uniqueSuggestions.length} duplicates`);
          console.log('[Upsell] Original:', suggestions.map(s => `${s.name} (${s.id})`));
          console.log('[Upsell] Unique:', uniqueSuggestions.map(s => `${s.name} (${s.id})`));
        }

        if (uniqueSuggestions.length > 0) {
          console.log(`[Upsell] Found ${uniqueSuggestions.length} unique suggestions:`, uniqueSuggestions.map(s => s.name).join(', '));
          setUpsellSuggestions(uniqueSuggestions);
          
          // Clear any existing reset timer
          if (upsellResetTimer) {
            clearTimeout(upsellResetTimer);
          }
          
          // Set auto-reset timer: clear upsells after 15 seconds of inactivity
          const resetTimer = setTimeout(() => {
            console.log('[Upsell] Auto-reset: Clearing suggestions after 15s inactivity');
            setUpsellSuggestions([]);
            setUpsellTriggerItem(null);
          }, 15000); // 15 seconds
          
          setUpsellResetTimer(resetTimer);
        } else {
          console.log("[Upsell] No relevant suggestions");
          setUpsellSuggestions([]);
        }
      } catch (err) {
        console.error("Failed to get upsell suggestions:", err);
      }
    }, 300);

    setUpsellDebounceTimer(timer);
  };

  const handleUpsellSelect = async (item: any, event?: React.MouseEvent) => {
    // Add upsell item to cart using same logic as handleAddItem
    const price = item.has_variants 
      ? (item.item_variants?.[0]?.price || item.base_price)
      : item.base_price;

    if (!price) {
      showToast("Item has no price configured", "error");
      return;
    }

    addLine({
      item_id: item.id,
      item_name: item.name,
      variant_id: item.has_variants ? item.item_variants?.[0]?.id : null,
      variant_name: item.has_variants ? item.item_variants?.[0]?.name : null,
      quantity: 1,
      unit_price: price,
      modifiers: [],
      notes: "",
      tax_rate: 0, // Prices already include VAT
    });

    // Track successful upsell with confidence score
    if (upsellTriggerItem && session?.org_id) {
      const confidence = upsellLearningEngine.getConfidence(upsellTriggerItem.id, item.id);
      
      // Track acceptance in analytics using existing table structure
      try {
        await fetch('/api/analytics/upsell', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            events: [{
              org_id: session.org_id,
              member_id: session.employee.id,
              trigger_item_id: upsellTriggerItem.id,
              trigger_item_name: upsellTriggerItem.name,
              suggested_item_id: item.id,
              suggested_item_name: item.name,
              action: 'accepted',
              suggestion_reason: confidence ? 'frequently_bought_together' : 'complementary_category',
              confidence_score: confidence, // NEW: Track how confident the suggestion was
              suggestion_type: confidence ? 'learned' : 'fallback', // NEW: Was it learned or fallback?
            }]
          }),
        });
        
        console.log(`[Upsell] Tracked acceptance: ${item.name} (confidence: ${confidence ? (confidence * 100).toFixed(0) + '%' : 'N/A'})`);
      } catch (err) {
        console.error('[Upsell] Failed to track acceptance:', err);
      }
    }

    // Trigger flying animation if event provided
    if (event) {
      triggerFlyingAnimation(item.name, event);
    }

    // Recalculate suggestions immediately with updated cart
    // This shows new relevant items, excluding what's now in cart
    if (upsellTriggerItem) {
      // Find the full item object
      const triggerItemFull = items.find(i => i.id === upsellTriggerItem.id);
      if (triggerItemFull) {
        const updatedSuggestions = upsellLearningEngine.getSuggestions(
          triggerItemFull, 
          lines, // Now includes the item we just added
          8
        );
        
        // Remove duplicates by name
        const uniqueSuggestions = updatedSuggestions.filter((item, index, self) =>
          index === self.findIndex((t) => t.name === item.name)
        );
        
        console.log(`[Upsell] Updated suggestions after adding ${item.name}:`, uniqueSuggestions.map(s => s.name).join(', '));
        setUpsellSuggestions(uniqueSuggestions);
        
        // Reset the 15-second timer since user is actively interacting
        if (upsellResetTimer) {
          clearTimeout(upsellResetTimer);
        }
        
        const resetTimer = setTimeout(() => {
          console.log('[Upsell] Auto-reset: Clearing suggestions after 15s inactivity');
          setUpsellSuggestions([]);
          setUpsellTriggerItem(null);
        }, 15000);
        
        setUpsellResetTimer(resetTimer);
      }
    }
  };

  const handlePriceConfirm = (price: number) => {
    if (!selectedItem) return;

    addLine({
      item_id: selectedItem.id,
      item_name: selectedItem.name,
      variant_id: null,
      variant_name: null,
      quantity: 1,
      unit_price: price,
      modifiers: [],
      notes: "",
      tax_rate: 0, // Prices already include VAT
    });

    setSelectedItem(null);
  };

  const handleVariantSelect = (variant: any) => {
    console.log('[handleVariantSelect] Called with pending event:', !!pendingItemEvent);
    if (!selectedItem) return;

    // After variant selection, check for modifiers
    const event = pendingItemEvent;
    setVariantDialogOpen(false);
    setPendingItemEvent(null);
    console.log('[handleVariantSelect] Calling checkAndShowModifiers with event:', !!event);
    checkAndShowModifiers(selectedItem, variant, event || undefined);
  };

  const handleModifiersConfirm = (modifiers: any[]) => {
    if (!selectedItem) return;

    const price = selectedVariant
      ? selectedVariant.price
      : selectedItem.base_price;

    if (!price) {
      showToast("Item has no price configured", "error");
      return;
    }

    // Trigger item-to-ticket animation and haptic feedback
    hapticItemAdded();
    playItemAddedSound();

    addLine({
      item_id: selectedItem.id,
      item_name: selectedItem.name,
      variant_id: selectedVariant?.id || null,
      variant_name: selectedVariant?.name || null,
      quantity: 1,
      unit_price: price,
      modifiers: modifiers,
      notes: "",
      tax_rate: 0, // Prices already include VAT
    });

    // Trigger upsell suggestions after adding item with modifiers
    debouncedUpsellSuggestions(selectedItem);

    // Reset state
    setSelectedItem(null);
    setSelectedVariant(null);
    setModifierDialogOpen(false);
  };

  const handleSaveTicket = async (name: string, comment: string) => {
    if (!session) return;

    try {
      // Save to database
      const savedTicket = await TicketSyncService.saveTicket(
        session.org_id,
        session.register.id,
        session.employee.id,
        name,
        comment,
        lines,
        ticketAssignment,
        getTotal()
      );

      if (!savedTicket) {
        showToast('Failed to save ticket', 'error');
        return;
      }

      // Update local state
      const updatedTickets = [...savedTickets, savedTicket];
      setSavedTickets(updatedTickets);

      // Clear current ticket first
      lines.forEach(line => removeLine(line.id));
      
      // Clear upsell suggestions
      setUpsellSuggestions([]);
      setUpsellTriggerItem(null);
      
      // Clear ticket name/comment and assignment so next save will prompt
      setCurrentTicketName("");
      setCurrentTicketComment("");
      setTicketAssignment(null);

      // Trigger flying animation AFTER clearing (so button appears)
      setTimeout(() => {
      const ticketIndicator = document.querySelector('[data-ticket-indicator]');
      const openTicketsButton = document.querySelector('[data-open-tickets-button]');
      
      if (ticketIndicator && openTicketsButton) {
        const startRect = ticketIndicator.getBoundingClientRect();
        const endRect = openTicketsButton.getBoundingClientRect();
        
        // Create flying element
        const flyingEl = document.createElement('div');
        flyingEl.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span>${name}</span>
          </div>
        `;
        flyingEl.style.cssText = `
          position: fixed;
          left: ${startRect.left + startRect.width / 2}px;
          top: ${startRect.top + startRect.height / 2}px;
          transform: translate(-50%, -50%) scale(1);
          z-index: 10000;
          pointer-events: none;
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
          color: white;
          padding: 12px 20px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
          opacity: 1;
          box-shadow: 0 8px 24px rgba(249, 115, 22, 0.5);
        `;
        
        document.body.appendChild(flyingEl);
        
        // Force reflow
        flyingEl.offsetHeight;
        
        // Trigger animation
        flyingEl.style.left = `${endRect.left + endRect.width / 2}px`;
        flyingEl.style.top = `${endRect.top + endRect.height / 2}px`;
        flyingEl.style.opacity = '0';
        flyingEl.style.transform = 'translate(-50%, -50%) scale(0.3)';
        
        // Remove element after animation
        setTimeout(() => {
          if (document.body.contains(flyingEl)) {
            document.body.removeChild(flyingEl);
          }
        }, 600);
      }
      }, 50); // Small delay to let DOM update
      
      hapticSuccess();
      playSuccessSound();
    } catch (error) {
      console.error('[Tickets] Failed to save:', error);
      showToast('Failed to save ticket', 'error');
    }
  };

  const handleLoadTicket = async (ticketId: string) => {
    const ticket = savedTickets.find(t => t.id === ticketId);
    if (!ticket) return;

    // Clear current ticket first
    lines.forEach(line => removeLine(line.id));

    // Load ticket lines
    ticket.lines.forEach((line: any) => {
      addLine(line);
    });

    // Set the ticket name, comment, and assignment so we can auto-save later
    setCurrentTicketName(ticket.name);
    setCurrentTicketComment(ticket.comment || "");
    // Check both assignment and ticket_assignment fields (database uses ticket_assignment)
    setTicketAssignment(ticket.ticket_assignment || ticket.assignment || null);

    // Remove ticket from saved tickets (database)
    try {
      await TicketSyncService.deleteTickets([ticketId]);
      const updatedTickets = savedTickets.filter(t => t.id !== ticketId);
      setSavedTickets(updatedTickets);
    } catch (error) {
      console.error('[LoadTicket] Failed to delete ticket:', error);
    }

    hapticSuccess();
    playSuccessSound();
  };

  const handleDeleteTicket = async (ticketId: string | string[]) => {
    hapticDelete();
    playDeleteSound();
    const idsToDelete = Array.isArray(ticketId) ? ticketId : [ticketId];
    
    try {
      // Delete from database
      await TicketSyncService.deleteTickets(idsToDelete);
      
      // Update local state
      const updatedTickets = savedTickets.filter(t => !idsToDelete.includes(t.id));
      setSavedTickets(updatedTickets);
    } catch (error) {
      console.error('[Tickets] Failed to delete:', error);
      showToast('Failed to delete ticket', 'error');
    }
  };

  const handleAssignTicket = (assignee: { type: 'customer' | 'table'; name: string; customer?: any }) => {
    setTicketAssignment(assignee);
    hapticSuccess();
    playSuccessSound();
    
    // Show confirmation
    if (assignee.type === 'customer' && assignee.customer) {
      showToast(`Ticket assigned to ${assignee.name}`, 'success');
    }
  };

  const handleMergeTickets = async (ticketId: string | string[]) => {
    const idsToMerge = Array.isArray(ticketId) ? ticketId : [ticketId];
    
    // Get the first ticket to preserve its assignment
    const firstTicket = savedTickets.find(t => t.id === idsToMerge[0]);
    
    // Add all lines from all selected tickets to current ticket
    idsToMerge.forEach(id => {
      const ticket = savedTickets.find(t => t.id === id);
      if (ticket) {
        ticket.lines.forEach((line: any) => {
          addLine(line);
        });
      }
    });

    // If first ticket has assignment and current ticket doesn't, preserve it
    if (firstTicket?.ticket_assignment && !ticketAssignment) {
      setTicketAssignment(firstTicket.ticket_assignment);
      console.log('[Merge] Preserved assignment from first ticket:', firstTicket.ticket_assignment);
    }

    // Remove all merged tickets from saved tickets (database)
    try {
      await TicketSyncService.deleteTickets(idsToMerge);
      const updatedTickets = savedTickets.filter(t => !idsToMerge.includes(t.id));
      setSavedTickets(updatedTickets);
    } catch (error) {
      console.error('[Merge] Failed to delete tickets:', error);
    }

    hapticSuccess();
    playSuccessSound();
  };

  const handleMergeFromDialog = (ticketId: string | string[]) => {
    handleMergeTickets(ticketId);
    setMergeTicketsOpen(false);
  };

  const handleSplitFromDialog = (ticketId: string) => {
    const ticket = savedTickets.find(t => t.id === ticketId);
    if (!ticket) return;

    // Load the ticket first
    lines.forEach(line => removeLine(line.id));
    ticket.lines.forEach((line: any) => {
      addLine(line);
    });

    // Remove from saved tickets
    const updatedTickets = savedTickets.filter(t => t.id !== ticketId);
    setSavedTickets(updatedTickets);
    localStorage.setItem("pos_saved_tickets", JSON.stringify(updatedTickets));

    // Open split dialog
    setSplitTicketOpen(true);
  };

  const handleAddToCustomerFromDialog = (ticketId: string) => {
    const ticket = savedTickets.find(t => t.id === ticketId);
    if (!ticket) return;

    // Load the ticket first
    lines.forEach(line => removeLine(line.id));
    ticket.lines.forEach((line: any) => {
      addLine(line);
    });

    // Remove from saved tickets
    const updatedTickets = savedTickets.filter(t => t.id !== ticketId);
    setSavedTickets(updatedTickets);
    localStorage.setItem("pos_saved_tickets", JSON.stringify(updatedTickets));

    // Open assign dialog
    setAssignTicketOpen(true);
  };

  const handleSplitTicket = async (selectedLineIds: string[]) => {
    if (!session) return;
    
    // Get the selected lines
    const selectedLines = lines.filter(line => selectedLineIds.includes(line.id));
    
    if (selectedLines.length === 0) return;

    // Calculate total for split ticket
    const splitTotal = selectedLines.reduce((sum, line) => {
      const lineTotal = line.quantity * line.unit_price;
      const modifiersTotal = line.modifiers.reduce((modSum: number, mod: any) => modSum + (mod.price || 0), 0);
      return sum + lineTotal + modifiersTotal;
    }, 0);

    // Create name: "Split - [Assignment Name]" or just "Split"
    const splitName = ticketAssignment ? `Split - ${ticketAssignment.name}` : "Split";

    // Save split ticket to database with preserved assignment
    try {
      const savedTicket = await TicketSyncService.saveTicket(
        session.org_id,
        session.register.id,
        session.employee.id,
        splitName,
        "Split from current ticket",
        selectedLines,
        ticketAssignment, // Preserve the assignment
        splitTotal
      );

      if (savedTicket) {
        // Update local state
        const updatedTickets = [...savedTickets, savedTicket];
        setSavedTickets(updatedTickets);

        // Remove the selected lines from current ticket
        selectedLineIds.forEach(lineId => removeLine(lineId));

        hapticSuccess();
        playSuccessSound();
      }
    } catch (error) {
      console.error('[Split] Failed to save split ticket:', error);
      showToast('Failed to split ticket', 'error');
    }
  };

  const handleSync = async () => {
    try {
      // Force refresh bypasses cache and fetches fresh data
      setForceRefresh(true);
      setTimeout(() => setForceRefresh(false), 100);
    } catch (error) {
      console.error("[SellPage] Manual sync failed:", error);
    }
  };

  const handleLock = () => {
    sessionStorage.removeItem("pos_session");
    router.push("/lock");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-penkey-orange mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  // Calculate total quantity of items (sum of all line quantities)
  const totalItemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col">
      <SellHeader
        linesCount={totalItemCount}
        savedTicketsCount={savedTickets.length}
        total={getTotal()}
        syncing={syncing}
        onMenuClick={() => setSidebarOpen(true)}
        onTicketClick={() => setTicketModalOpen(true)}
        onAssignCustomerClick={() => {
          hapticButtonPress();
          playButtonSound();
          setAssignTicketOpen(true);
        }}
        onSaveTicketClick={() => {
          // If we already have a ticket name (from loading a ticket), auto-save
          if (currentTicketName) {
            handleSaveTicket(currentTicketName, currentTicketComment);
          } else if (ticketAssignment) {
            // If customer/table is assigned, auto-save with that name
            handleSaveTicket(ticketAssignment.name, "");
          } else {
            // Otherwise show the dialog
            setSaveTicketOpen(true);
          }
        }}
        onOpenTicketsClick={() => setOpenTicketsOpen(true)}
        onChargeClick={() => {
          if (lines.length === 0) {
            showToast('Add items to ticket first', 'error');
            return;
          }
          // Store ticket assignment for payment page
          if (ticketAssignment) {
            sessionStorage.setItem("pos_ticket_assignment", JSON.stringify(ticketAssignment));
          } else {
            sessionStorage.removeItem("pos_ticket_assignment");
          }
          playPaymentInitSound();
          router.push("/payment");
        }}
        onSyncClick={async () => {
          hapticButtonPress();
          playButtonSound();
          try {
            // Force refresh to bypass cache
            setForceRefresh(true);
            setTimeout(() => {
              setForceRefresh(false);
              showToast('Data synced successfully', 'success');
            }, 500);
          } catch (error) {
            showToast('Sync failed', 'error');
            console.error('[Sell] Sync error:', error);
          }
        }}
      />

      {/* Main Content - Responsive padding and proper spacing */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4">
          {/* Category Selector, Popular Filter, Search, and Layout Toggle */}
          <div className="mb-2 sm:mb-3 md:mb-4 flex gap-2">
            {!searchOpen ? (
              <>
                <button
                  onClick={() => setCategorySelectorOpen(true)}
                  className="bg-[#3d3d3d] text-white hover:bg-[#4d4d4d] rounded-lg px-3 py-2.5 sm:px-4 sm:py-3 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap min-w-fit"
                >
                  <Tag className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  <span className="text-xs sm:text-sm">
                    {selectedCategory
                      ? categories.find((c) => c.id === selectedCategory)?.name || "Category"
                      : "All"}
                  </span>
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => setShowPopular(!showPopular)}
                  className={`rounded-lg px-3 py-2.5 sm:px-4 sm:py-3 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap min-w-fit ${
                    showPopular
                      ? "bg-gradient-to-br from-yellow-500 to-orange-500 text-white"
                      : "bg-[#3d3d3d] text-white hover:bg-[#4d4d4d]"
                  }`}
                  title="Toggle popular items filter"
                >
                  <Star className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${showPopular ? "fill-white" : ""}`} />
                  <span className="text-xs sm:text-sm">Popular</span>
                </button>
                <button
                  onClick={() => setShowFavourites(!showFavourites)}
                  className={`rounded-lg px-3 py-2.5 sm:px-4 sm:py-3 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap min-w-fit ${
                    showFavourites
                      ? "bg-gradient-to-br from-yellow-400 to-yellow-500 text-[#2d2d2d]"
                      : "bg-[#3d3d3d] text-white hover:bg-[#4d4d4d]"
                  }`}
                  title="Toggle favourites filter"
                >
                  <Star className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${showFavourites ? "fill-[#2d2d2d]" : ""}`} />
                  <span className="text-xs sm:text-sm">Favourites</span>
                </button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={() => setSearchOpen(true)}
                  className="bg-[#3d3d3d] text-white hover:bg-[#4d4d4d] border border-gray-600 px-3 sm:px-4 h-10 sm:h-11 flex-shrink-0"
                  title="Search items"
                >
                  <Search className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={toggleLayout}
                  className="bg-[#3d3d3d] text-white hover:bg-[#4d4d4d] border border-gray-600 px-3 sm:px-4 h-10 sm:h-11 flex-shrink-0"
                  title={layout === "grid" ? "Switch to list view" : "Switch to grid view"}
                >
                  {layout === "grid" ? <List className="h-4 w-4 sm:h-5 sm:w-5" /> : <Grid3x3 className="h-4 w-4 sm:h-5 sm:w-5" />}
                </Button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search items..."
                  autoFocus
                  className="flex-1 bg-[#3d3d3d] text-white border border-gray-600 rounded-lg px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm focus:outline-none focus:border-penkey-orange placeholder-gray-500"
                />
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery("");
                  }}
                  className="bg-[#3d3d3d] text-white hover:bg-[#4d4d4d] border border-gray-600 px-3 sm:px-4 h-10 sm:h-11 flex-shrink-0"
                  title="Close search"
                >
                  <X className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </>
            )}
          </div>

          {/* Items Display */}
          <ItemsDisplay
            displayLoading={displayLoading}
            filteredItems={filteredItems}
            layout={layout}
            gridSize={registerSettingsData.grid_size}
            font_size={registerSettingsData.font_size}
            clickedItemId={clickedItemId}
            onAddItem={handleAddItem}
          />
        </div>
      </div>

      {session && registerSettingsData.penkey_prompts_enabled && (
        <PenkeyPromptsBar
          key="penkey-prompts-bar-singleton"
          upsellSuggestions={upsellSuggestions}
          onSelectUpsellItem={handleUpsellSelect}
          triggerItem={upsellTriggerItem || undefined}
          dailySales={stats.sales}
          upsellCount={stats.upsellCount}
          itemsSold={stats.itemsSold}
          openTicketsCount={savedTickets.length}
          onOpenTickets={() => setOpenTicketsOpen(true)}
          onViewStats={() => router.push("/reports")}
          orgId={session?.org_id}
          memberId={session?.employee.id}
        />
      )}

      {/* Variant Dialog */}
      {selectedItem && variantDialogOpen && (
        <VariantDialog
          open={variantDialogOpen}
          onClose={() => {
            setVariantDialogOpen(false);
            setSelectedItem(null);
            setPendingItemEvent(null);
          }}
          itemName={selectedItem.name}
          variants={selectedItem.item_variants || []}
          gridSize={registerSettingsData.grid_size}
          onSelect={handleVariantSelect}
        />
      )}

      {/* Modifier Dialog - Singleton Pattern (always rendered, hidden when closed) */}
      <ModifierDialog
        open={modifierDialogOpen}
        onClose={() => {
          setModifierDialogOpen(false);
          setSelectedItem(null);
          setSelectedVariant(null);
        }}
        itemId={selectedItem?.id || ""}
        itemName={
          selectedItem
            ? selectedVariant
              ? `${selectedItem.name} - ${selectedVariant.name}`
              : selectedItem.name
            : ""
        }
        basePrice={selectedVariant ? selectedVariant.price : selectedItem?.base_price || 0}
        gridSize={registerSettingsData.grid_size}
        onConfirm={handleModifiersConfirm}
        triggerAnimation={triggerFlyingAnimation}
      />

      {/* Ticket Modal */}
      <TicketModal
        open={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        lines={lines}
        updateQuantity={updateQuantity}
        removeLine={removeLine}
        getSubtotal={getSubtotal}
        getTaxTotal={getTaxTotal}
        getTotal={getTotal}
        onCheckout={() => {
          // Store ticket assignment for payment page
          if (ticketAssignment) {
            sessionStorage.setItem("pos_ticket_assignment", JSON.stringify(ticketAssignment));
          } else {
            sessionStorage.removeItem("pos_ticket_assignment");
          }
          playPaymentInitSound();
          router.push("/payment");
        }}
        onSave={() => setSaveTicketOpen(true)}
        onClearAll={() => setClearConfirmOpen(true)}
        ticketAssignment={ticketAssignment}
      />

      {/* Sidebar Menu */}
      <SidebarMenu
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLock={handleLock}
        onSync={handleSync}
        syncing={syncing}
        lastSync={lastSync}
        storeName={session.register.store_name}
        registerName={session.register.name}
      />

      {/* Profile Menu */}
      <ProfileMenu
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onLock={handleLock}
        employeeName={session.employee.name}
        employeeRole={session.employee.role}
      />

      {/* Ticket Actions Menu */}
      <TicketActionsMenu
        open={ticketActionsOpen}
        onClose={() => setTicketActionsOpen(false)}
        onClearTicket={() => {
          setClearConfirmOpen(true);
        }}
        onEditTicket={() => {
          // Open save dialog to edit current ticket name/comment
          setSaveTicketOpen(true);
        }}
        onAssignTicket={() => {
          setAssignTicketOpen(true);
        }}
        onMergeTickets={() => {
          if (savedTickets.length === 0) {
            showToast('No saved tickets to merge with', 'error');
            return;
          }
          if (savedTickets.length === 1) {
            showToast('Need at least 2 saved tickets to merge', 'error');
            return;
          }
          setMergeTicketsOpen(true);
        }}
        onSplitTicket={() => {
          if (lines.length < 2) {
            showToast('Need at least 2 items to split', 'error');
            return;
          }
          setSplitTicketOpen(true);
        }}
        hasItems={lines.length > 0}
      />

      {/* Save Ticket Dialog */}
      <SaveTicketDialog
        open={saveTicketOpen}
        onClose={() => setSaveTicketOpen(false)}
        onSave={handleSaveTicket}
        ticketAssignment={ticketAssignment}
      />

      {/* Open Tickets Dialog */}
      <OpenTicketsDialog
        open={openTicketsOpen}
        onClose={() => setOpenTicketsOpen(false)}
        tickets={savedTickets}
        onLoadTicket={handleLoadTicket}
        onDeleteTicket={handleDeleteTicket}
        onMergeTickets={handleMergeFromDialog}
        onSplitTicket={handleSplitFromDialog}
        onAddToCustomer={handleAddToCustomerFromDialog}
      />

      {/* Price Input Dialog */}
      <PriceInputDialog
        open={priceInputOpen}
        onClose={() => {
          setPriceInputOpen(false);
          setSelectedItem(null);
        }}
        onConfirm={handlePriceConfirm}
        itemName={selectedItem?.name || ""}
      />

      {/* Category Selector Dialog */}
      <CategorySelectorDialog
        open={categorySelectorOpen}
        onClose={() => setCategorySelectorOpen(false)}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        gridSize={registerSettingsData.grid_size}
      />

      {/* Clear Ticket Confirm Dialog */}
      <ConfirmDialog
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={async () => {
          clearCart();
          setCurrentTicketName("");
          setCurrentTicketComment("");
          setTicketAssignment(null);
          await CartSyncService.clearCart();
          hapticDelete();
          playDeleteSound();
        }}
        title="Clear Ticket"
        message="Are you sure you want to clear all items from this ticket?"
        confirmText="Clear All"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Assign Ticket Dialog */}
      <AssignTicketDialog
        open={assignTicketOpen}
        onClose={() => setAssignTicketOpen(false)}
        onAssign={handleAssignTicket}
      />

      {/* Merge Tickets Dialog */}
      <MergeTicketsDialog
        open={mergeTicketsOpen}
        onClose={() => setMergeTicketsOpen(false)}
        tickets={savedTickets}
        onMerge={handleMergeTickets}
      />


      {/* Split Ticket Dialog */}
      <SplitTicketDialog
        open={splitTicketOpen}
        onClose={() => setSplitTicketOpen(false)}
        lines={lines}
        onSplit={handleSplitTicket}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
