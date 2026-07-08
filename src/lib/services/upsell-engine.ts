/**
 * Client-side Upsell Engine
 * Calculates upsell suggestions instantly from cached data
 * No API calls - uses items already in memory
 */

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
  category_id?: string | null;
}

export class UpsellEngine {
  private items: Item[] = [];
  private categoryMap: Map<string, Item[]> = new Map();
  
  /**
   * Initialize with all available items (from cache)
   */
  initialize(items: Item[]): void {
    this.items = items;
    
    // Build category map for fast lookups
    this.categoryMap.clear();
    items.forEach(item => {
      if (item.category_id) {
        const categoryItems = this.categoryMap.get(item.category_id) || [];
        categoryItems.push(item);
        this.categoryMap.set(item.category_id, categoryItems);
      }
    });
    
    console.log(`[UpsellEngine] Initialized with ${items.length} items`);
  }
  
  /**
   * Get instant upsell suggestions based on current ticket
   * Uses multiple strategies for best results
   */
  getSuggestions(
    triggerItem: Item,
    cartLines: CartLine[],
    limit: number = 4
  ): Item[] {
    const suggestions: Item[] = [];
    const itemsInCart = new Set(cartLines.map(line => line.item_id));
    const categoriesInCart = new Set(
      cartLines.map(line => line.category_id).filter(Boolean)
    );
    
    // Strategy 1: Complementary categories
    // If they bought food, suggest drinks; if drinks, suggest food
    const complementarySuggestions = this.getComplementaryItems(
      triggerItem,
      categoriesInCart,
      itemsInCart
    );
    suggestions.push(...complementarySuggestions);
    
    // Strategy 2: Same category (similar items)
    if (triggerItem.category_id && suggestions.length < limit) {
      const sameCategorySuggestions = this.getSameCategoryItems(
        triggerItem,
        itemsInCart
      );
      suggestions.push(...sameCategorySuggestions);
    }
    
    // Strategy 3: High-value items (premium upsell)
    if (suggestions.length < limit) {
      const premiumSuggestions = this.getHighValueItems(itemsInCart);
      suggestions.push(...premiumSuggestions);
    }
    
    // Remove duplicates and limit
    const uniqueSuggestions = Array.from(
      new Map(suggestions.map(item => [item.id, item])).values()
    );
    
    return uniqueSuggestions.slice(0, limit);
  }
  
  /**
   * Get items from complementary categories
   */
  private getComplementaryItems(
    triggerItem: Item,
    categoriesInCart: Set<string | null | undefined>,
    itemsInCart: Set<string>
  ): Item[] {
    // Define complementary category pairs by category NAME (not ID)
    // This works across different category IDs as long as names match
    const complementaryCategories: Record<string, string[]> = {
      // Coffee/Hot Drinks → Pastries, Cakes, Desserts
      'coffee': ['pastries', 'cakes', 'desserts', 'breakfast'],
      'hot drinks': ['pastries', 'cakes', 'desserts', 'breakfast'],
      'coffee drinks': ['pastries', 'cakes', 'desserts', 'breakfast'],
      
      // Food/Sandwiches → Coffee, Drinks
      'sandwiches': ['coffee', 'hot drinks', 'cold drinks'],
      'food': ['coffee', 'hot drinks', 'cold drinks'],
      'hot food': ['coffee', 'hot drinks', 'cold drinks'],
      'breakfast': ['coffee', 'hot drinks'],
      
      // Pastries/Cakes → Coffee, Tea
      'pastries': ['coffee', 'hot drinks', 'tea'],
      'cakes': ['coffee', 'hot drinks', 'tea'],
      'desserts': ['coffee', 'hot drinks', 'tea'],
      
      // Cold Drinks → Food, Snacks
      'cold drinks': ['food', 'sandwiches', 'snacks'],
      'soft drinks': ['food', 'sandwiches', 'snacks'],
      
      // Tea → Cakes, Pastries
      'tea': ['cakes', 'pastries', 'desserts'],
    };
    
    if (!triggerItem.category_id) return [];
    
    // Get the category name for the trigger item
    const triggerCategory = this.items.find(i => i.id === triggerItem.id);
    if (!triggerCategory?.category_id) return [];
    
    // Find items in the same category to get the category name
    const categoryItems = this.categoryMap.get(triggerCategory.category_id);
    if (!categoryItems || categoryItems.length === 0) return [];
    
    // Use the first item to get category info (we'd need category table for proper lookup)
    // For now, we'll use a simple matching strategy based on item names
    const triggerItemName = triggerItem.name.toLowerCase();
    
    // Determine complementary categories based on item name patterns
    let complementaryCategoryNames: string[] = [];
    
    if (triggerItemName.includes('coffee') || triggerItemName.includes('cappuccino') || 
        triggerItemName.includes('latte') || triggerItemName.includes('americano') ||
        triggerItemName.includes('espresso') || triggerItemName.includes('flat white')) {
      complementaryCategoryNames = ['pastries', 'cakes', 'desserts', 'brownie', 'cookie', 'muffin', 'slice'];
    } else if (triggerItemName.includes('sandwich') || triggerItemName.includes('panini') ||
               triggerItemName.includes('baguette') || triggerItemName.includes('toast')) {
      complementaryCategoryNames = ['coffee', 'latte', 'cappuccino', 'drink'];
    } else if (triggerItemName.includes('cake') || triggerItemName.includes('brownie') ||
               triggerItemName.includes('muffin') || triggerItemName.includes('cookie') ||
               triggerItemName.includes('pastry') || triggerItemName.includes('slice')) {
      complementaryCategoryNames = ['coffee', 'latte', 'cappuccino', 'tea', 'americano'];
    } else if (triggerItemName.includes('tea')) {
      complementaryCategoryNames = ['cake', 'brownie', 'cookie', 'muffin', 'pastry'];
    }
    
    const suggestions: Item[] = [];
    
    // Find items matching complementary category name patterns
    this.items.forEach(item => {
      if (itemsInCart.has(item.id) || item.id === triggerItem.id) return;
      
      const itemName = item.name.toLowerCase();
      
      // Check if item matches any complementary category pattern
      const isComplementary = complementaryCategoryNames.some(pattern => 
        itemName.includes(pattern)
      );
      
      // Exclude gifts and retail items
      const isGiftOrRetail = itemName.includes('gift') || 
                           itemName.includes('retail') ||
                           itemName.includes('card') ||
                           itemName.includes('merchandise');
      
      if (isComplementary && !isGiftOrRetail && suggestions.length < 4) {
        suggestions.push(item);
      }
    });
    
    return suggestions;
  }
  
  /**
   * Get items from same category (similar products)
   */
  private getSameCategoryItems(
    triggerItem: Item,
    itemsInCart: Set<string>
  ): Item[] {
    if (!triggerItem.category_id) return [];
    
    const categoryItems = this.categoryMap.get(triggerItem.category_id) || [];
    
    return categoryItems
      .filter(item => 
        item.id !== triggerItem.id && 
        !itemsInCart.has(item.id)
      )
      .slice(0, 2);
  }
  
  /**
   * Get high-value items for premium upsell
   */
  private getHighValueItems(itemsInCart: Set<string>): Item[] {
    return this.items
      .filter(item => {
        if (itemsInCart.has(item.id)) return false;
        
        // Exclude gifts and retail items
        const itemName = item.name.toLowerCase();
        const isGiftOrRetail = itemName.includes('gift') || 
                             itemName.includes('retail') ||
                             itemName.includes('card') ||
                             itemName.includes('merchandise');
        if (isGiftOrRetail) return false;
        
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
      .slice(0, 2);
  }
  
  /**
   * Check if engine is ready
   */
  isReady(): boolean {
    return this.items.length > 0;
  }
}

// Export singleton instance
export const upsellEngine = new UpsellEngine();
