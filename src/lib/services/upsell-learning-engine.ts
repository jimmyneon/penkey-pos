/**
 * Smart Upsell Learning Engine
 * Learns from actual purchase patterns in your database
 * "People who bought X also bought Y" analysis
 */

import { dataCache } from "./data-cache";

interface Item {
  id: string;
  name: string;
  category_id: string | null;
  base_price: number | null;
  image_url: string | null;
  has_variants: boolean;
  item_variants?: Array<{
    id: string;
    name: string;
    price: number;
    is_default: boolean;
  }>;
}

interface CartLine {
  item_id: string;
  item_name: string;
  category_id?: string;
}

interface ItemPair {
  item_a_id: string;
  item_b_id: string;
  frequency: number;
  confidence: number; // How often B is bought when A is bought (0-1)
}

export class UpsellLearningEngine {
  private items: Item[] = [];
  private itemMap: Map<string, Item> = new Map();
  private associations: Map<string, ItemPair[]> = new Map(); // item_id -> related items
  private orgId: string | null = null;
  private categoryMap: Map<string, string> = new Map(); // category_id -> category name
  
  // Smart category pairings: what goes well with what
  private categoryPairings: Record<string, string[]> = {
    // Coffee/Hot Drinks → Pastries, Breakfast, Snacks
    'coffee': ['pastries', 'breakfast', 'bakery', 'snacks', 'cakes', 'desserts'],
    'hot drinks': ['pastries', 'breakfast', 'bakery', 'snacks', 'cakes', 'desserts'],
    'tea': ['pastries', 'breakfast', 'bakery', 'snacks', 'cakes', 'desserts'],
    
    // Cold Drinks → Snacks, Sandwiches, Salads
    'cold drinks': ['snacks', 'sandwiches', 'salads', 'wraps'],
    'juice': ['snacks', 'sandwiches', 'salads', 'breakfast'],
    'smoothies': ['snacks', 'breakfast', 'salads'],
    
    // Food → Drinks
    'sandwiches': ['cold drinks', 'coffee', 'hot drinks', 'snacks'],
    'salads': ['cold drinks', 'juice', 'snacks'],
    'breakfast': ['coffee', 'hot drinks', 'juice', 'pastries'],
    'lunch': ['cold drinks', 'coffee', 'snacks'],
    
    // Pastries → Coffee/Tea
    'pastries': ['coffee', 'hot drinks', 'tea'],
    'bakery': ['coffee', 'hot drinks', 'tea'],
    'cakes': ['coffee', 'hot drinks', 'tea'],
    'desserts': ['coffee', 'hot drinks', 'tea'],
    
    // Snacks → Drinks
    'snacks': ['cold drinks', 'coffee', 'hot drinks'],
    'crisps': ['cold drinks'],
  };
  
  /**
   * Initialize with all available items, categories, and org ID
   */
  initialize(items: Item[], orgId?: string, categories?: Array<{id: string, name: string}>): void {
    this.items = items;
    if (orgId) {
      this.orgId = orgId;
    }
    
    // Build item map for fast lookups
    this.itemMap.clear();
    items.forEach(item => {
      this.itemMap.set(item.id, item);
    });
    
    // Build category map
    if (categories) {
      this.categoryMap.clear();
      categories.forEach(cat => {
        this.categoryMap.set(cat.id, cat.name.toLowerCase());
      });
      console.log(`[UpsellLearning] Loaded ${categories.length} categories`);
    }
    
    console.log(`[UpsellLearning] Initialized with ${items.length} items`);
  }
  
  /**
   * Load learned associations from cache or API
   * This should be called after initialize
   */
  async loadAssociations(orgId: string, forceRefresh: boolean = false): Promise<void> {
    try {
      // Check cache first
      if (!forceRefresh) {
        const cached = dataCache.get<Map<string, ItemPair[]>>(orgId, "upsell_associations");
        if (cached) {
          // Convert plain object back to Map
          this.associations = new Map(Object.entries(cached));
          console.log(`[UpsellLearning] Loaded ${this.associations.size} associations from cache`);
          return;
        }
      }

      // Fetch from API
      console.log("[UpsellLearning] Fetching associations from API...");
      const response = await fetch(`/api/analytics/item-associations?org_id=${orgId}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[UpsellLearning] API returned ${data.length} association pairs`);
        
        // Build associations map
        this.associations.clear();
        data.forEach((pair: ItemPair) => {
          const existing = this.associations.get(pair.item_a_id) || [];
          existing.push(pair);
          this.associations.set(pair.item_a_id, existing);
        });
        
        // Cache for 6 hours (updates throughout the day)
        const cacheService = new (await import("./data-cache")).DataCacheService({ ttlHours: 6 });
        // Convert Map to plain object for JSON serialization
        const cacheData = Object.fromEntries(this.associations);
        cacheService.set(orgId, "upsell_associations", cacheData);
        
        console.log(`[UpsellLearning] Loaded ${this.associations.size} unique items with associations`);
        // Log a sample
        if (this.associations.size > 0) {
          const firstKey = Array.from(this.associations.keys())[0];
          const firstAssocs = this.associations.get(firstKey);
          console.log(`[UpsellLearning] Sample: Item ${firstKey} has ${firstAssocs?.length} associations`);
        }
      } else {
        const errorText = await response.text();
        console.warn(`[UpsellLearning] Failed to load associations (${response.status}):`, errorText);
      }
    } catch (err) {
      console.error("[UpsellLearning] Error loading associations:", err);
    }
  }
  
  /**
   * Get smart upsell suggestions based on learned patterns
   */
  getSuggestions(
    triggerItem: Item,
    cartLines: CartLine[],
    limit: number = 4
  ): Item[] {
    const suggestions: Item[] = [];
    const itemsInCart = new Set(cartLines.map(line => line.item_id));
    const seenNames = new Set<string>(); // Track names to avoid duplicate items with same name
    
    // Strategy 1: Learned associations (highest priority)
    const learnedSuggestions = this.getLearnedAssociations(
      triggerItem,
      itemsInCart
    );
    for (const item of learnedSuggestions) {
      if (!seenNames.has(item.name) && suggestions.length < limit) {
        suggestions.push(item);
        seenNames.add(item.name);
      }
    }
    
    // Strategy 2: Category-based fallback (if not enough learned data)
    if (suggestions.length < limit) {
      const fallbackSuggestions = this.getCategoryFallback(
        triggerItem,
        itemsInCart,
        limit * 2 // Get more to filter from
      );
      for (const item of fallbackSuggestions) {
        if (!seenNames.has(item.name) && suggestions.length < limit) {
          suggestions.push(item);
          seenNames.add(item.name);
        }
      }
    }
    
    // Strategy 3: High-value items (premium upsell)
    if (suggestions.length < limit) {
      const premiumSuggestions = this.getHighValueItems(
        itemsInCart,
        limit * 2 // Get more to filter from
      );
      for (const item of premiumSuggestions) {
        if (!seenNames.has(item.name) && suggestions.length < limit) {
          suggestions.push(item);
          seenNames.add(item.name);
        }
      }
    }
    
    console.log(`[UpsellLearning] Built ${suggestions.length} unique suggestions (no duplicates)`);
    return suggestions;
  }
  
  /**
   * Get items based on learned purchase patterns
   * "People who bought coffee also bought cake"
   */
  private getLearnedAssociations(
    triggerItem: Item,
    itemsInCart: Set<string>
  ): Item[] {
    const associations = this.associations.get(triggerItem.id) || [];
    
    if (associations.length === 0) {
      console.log(`[UpsellLearning] No learned associations for ${triggerItem.name}`);
      return [];
    }
    
    // Sort by confidence (how often they're bought together)
    const sortedAssociations = associations
      .filter(pair => !itemsInCart.has(pair.item_b_id))
      .sort((a, b) => b.confidence - a.confidence);
    
    // Get the actual item objects
    const suggestions: Item[] = [];
    for (const pair of sortedAssociations) {
      const item = this.itemMap.get(pair.item_b_id);
      if (item) {
        suggestions.push(item);
        console.log(
          `[UpsellLearning] Suggesting ${item.name} (${(pair.confidence * 100).toFixed(0)}% confidence)`
        );
      }
    }
    
    return suggestions;
  }
  
  /**
   * Fallback: Smart complementary items based on category pairings
   * Coffee → Pastries, Cakes, Breakfast items
   * Sandwiches → Drinks, Snacks
   * etc.
   */
  private getCategoryFallback(
    triggerItem: Item,
    itemsInCart: Set<string>,
    limit: number
  ): Item[] {
    if (!triggerItem.category_id) {
      console.log('[UpsellLearning] No category for trigger item, using random fallback');
      return this.getRandomFallback(itemsInCart, limit);
    }
    
    // Get trigger item's category name
    const triggerCategoryName = this.categoryMap.get(triggerItem.category_id)?.toLowerCase();
    if (!triggerCategoryName) {
      console.log('[UpsellLearning] Category name not found, using random fallback');
      return this.getRandomFallback(itemsInCart, limit);
    }
    
    // Find matching pairing rule (check for partial matches)
    let pairedCategories: string[] = [];
    for (const [key, values] of Object.entries(this.categoryPairings)) {
      if (triggerCategoryName.includes(key) || key.includes(triggerCategoryName)) {
        pairedCategories = values;
        console.log(`[UpsellLearning] ${triggerCategoryName} → suggesting from: ${values.join(', ')}`);
        break;
      }
    }
    
    // If no pairing found, use complementary (different) categories
    if (pairedCategories.length === 0) {
      console.log(`[UpsellLearning] No pairing rule for "${triggerCategoryName}", using complementary categories`);
      return this.getRandomFallback(itemsInCart, limit);
    }
    
    // Get items from paired categories
    const suggestions: Item[] = [];
    const seenNames = new Set<string>();
    
    for (const pairedCatName of pairedCategories) {
      if (suggestions.length >= limit) break;
      
      // Find items in this paired category
      for (const item of this.items) {
        if (suggestions.length >= limit) break;
        if (itemsInCart.has(item.id)) continue;
        if (seenNames.has(item.name)) continue;
        if (!item.category_id) continue;
        
        const itemCategoryName = this.categoryMap.get(item.category_id)?.toLowerCase();
        if (!itemCategoryName) continue;
        
        // Check if item's category matches the paired category
        if (itemCategoryName.includes(pairedCatName) || pairedCatName.includes(itemCategoryName)) {
          suggestions.push(item);
          seenNames.add(item.name);
          console.log(`[UpsellLearning]   → ${item.name} (from ${itemCategoryName})`);
        }
      }
    }
    
    return suggestions;
  }
  
  /**
   * Random fallback when no smart pairing is available
   */
  private getRandomFallback(itemsInCart: Set<string>, limit: number): Item[] {
    const complementaryItems = this.items
      .filter(item => 
        item.id &&
        !itemsInCart.has(item.id)
      );
    
    // Shuffle and take first N
    const shuffled = complementaryItems.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit);
  }
  
  /**
   * Get high-value items for premium upsell
   */
  private getHighValueItems(itemsInCart: Set<string>, limit: number): Item[] {
    return this.items
      .filter(item => {
        if (itemsInCart.has(item.id)) return false;
        
        const price = item.has_variants
          ? Math.max(...(item.item_variants?.map(v => v.price) || [0]))
          : item.base_price || 0;
        
        return price > 5; // Adjust threshold for your business
      })
      .sort((a, b) => {
        const priceA = a.has_variants
          ? Math.max(...(a.item_variants?.map(v => v.price) || [0]))
          : a.base_price || 0;
        const priceB = b.has_variants
          ? Math.max(...(b.item_variants?.map(v => v.price) || [0]))
          : b.base_price || 0;
        return priceB - priceA;
      })
      .slice(0, limit);
  }
  
  /**
   * Check if engine is ready
   */
  isReady(): boolean {
    return this.items.length > 0;
  }
  
  /**
   * Get statistics about learned associations
   */
  getStats(): { totalAssociations: number; itemsWithAssociations: number } {
    return {
      totalAssociations: Array.from(this.associations.values())
        .reduce((sum, pairs) => sum + pairs.length, 0),
      itemsWithAssociations: this.associations.size,
    };
  }

  /**
   * Get association confidence for a specific item pair
   * Used to track if high-confidence suggestions are being accepted
   */
  getConfidence(itemAId: string, itemBId: string): number | null {
    const associations = this.associations.get(itemAId) || [];
    const pair = associations.find(p => p.item_b_id === itemBId);
    return pair ? pair.confidence : null;
  }
}

// Export singleton instance
export const upsellLearningEngine = new UpsellLearningEngine();
