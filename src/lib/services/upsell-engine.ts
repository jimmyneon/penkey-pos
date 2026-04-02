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
  category_id?: string;
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
    categoriesInCart: Set<string | undefined>,
    itemsInCart: Set<string>
  ): Item[] {
    // Define complementary category pairs (customize for your business)
    const complementaryMap: Record<string, string[]> = {
      // Add your category relationships here
      // Example: 'food': ['drinks', 'desserts']
    };
    
    if (!triggerItem.category_id) return [];
    
    const complementaryCategories = complementaryMap[triggerItem.category_id] || [];
    const suggestions: Item[] = [];
    
    complementaryCategories.forEach(categoryId => {
      const categoryItems = this.categoryMap.get(categoryId) || [];
      const available = categoryItems.filter(item => !itemsInCart.has(item.id));
      suggestions.push(...available.slice(0, 2)); // 2 per category
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
