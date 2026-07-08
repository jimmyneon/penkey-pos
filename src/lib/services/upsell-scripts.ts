/**
 * Curated Upsell Script Engine
 *
 * Instead of relying purely on the learning engine (which needs lots of data),
 * this provides hand-crafted upsell rules with scripted yes/no questions.
 *
 * Key principle: Questions are DIRECT (yes/no), not open-ended.
 * "Are you having a chocolate brownie with that?" not "Would you like anything else?"
 */

export interface UpsellScriptRule {
  id: string;
  triggerCategoryKeywords: string[];
  triggerItemNameKeywords?: string[];
  excludeItemNameKeywords?: string[];
  suggestedCategoryKeywords: string[];
  suggestedItemNameKeywords?: string[];
  question: string;
  fallbackQuestion?: string;
  priority: number;
}

export interface UpsellScriptResult {
  question: string;
  suggestedItems: Array<{
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
  }>;
  triggerItemName: string;
}

const SCRIPT_RULES: UpsellScriptRule[] = [
  {
    id: 'coffee-sweet-treat',
    triggerCategoryKeywords: ['coffee', 'hot drinks', 'tea'],
    suggestedCategoryKeywords: ['cakes', 'bakery', 'pastries', 'desserts'],
    suggestedItemNameKeywords: ['brownie', 'cake', 'flapjack', 'cookie', 'muffin', 'scone', 'shortbread'],
    question: "Are you having a chocolate brownie with that?",
    fallbackQuestion: "Would you like a cake or sweet treat with your drink?",
    priority: 10,
  },
  {
    id: 'coffee-savory-snack',
    triggerCategoryKeywords: ['coffee', 'hot drinks', 'tea'],
    excludeItemNameKeywords: ['hot chocolate', 'mocha', 'caramel', 'vanilla', 'syrup'],
    suggestedCategoryKeywords: ['snacks', 'savoury', 'food'],
    suggestedItemNameKeywords: ['sausage roll', 'croissant', 'toastie', 'panini', 'sandwich'],
    question: "Would you like a sausage roll to go with that?",
    fallbackQuestion: "How about a savory snack with your drink?",
    priority: 8,
  },
  {
    id: 'sandwich-extras',
    triggerCategoryKeywords: ['sandwiches', 'lunch', 'food', 'paninis', 'wraps'],
    suggestedCategoryKeywords: ['snacks', 'cold drinks', 'crisps', 'sides'],
    suggestedItemNameKeywords: ['crisps', 'drink', 'cola', 'water', 'juice'],
    question: "Would you like a drink and crisps with your sandwich?",
    fallbackQuestion: "Can I get you a drink or side with that?",
    priority: 10,
  },
  {
    id: 'breakfast-extras',
    triggerCategoryKeywords: ['breakfast'],
    suggestedCategoryKeywords: ['coffee', 'hot drinks', 'cold drinks'],
    suggestedItemNameKeywords: ['coffee', 'tea', 'latte', 'americano', 'cappuccino', 'flat white', 'juice'],
    question: "Would you like a coffee with your breakfast?",
    fallbackQuestion: "Can I get you a hot drink with that?",
    priority: 10,
  },
  {
    id: 'lunch-deal-drink',
    triggerCategoryKeywords: ['lunch', 'sandwiches', 'salads', 'wraps', 'paninis'],
    suggestedCategoryKeywords: ['cold drinks', 'coffee', 'hot drinks'],
    suggestedItemNameKeywords: ['cola', 'water', 'juice', 'smoothie', 'coffee', 'tea'],
    question: "Would you like a drink with your lunch?",
    fallbackQuestion: "Can I get you a drink to go with that?",
    priority: 9,
  },
  {
    id: 'cake-drink-pairing',
    triggerCategoryKeywords: ['cakes', 'bakery', 'pastries', 'desserts'],
    suggestedCategoryKeywords: ['coffee', 'hot drinks', 'tea', 'cold drinks'],
    suggestedItemNameKeywords: ['coffee', 'tea', 'latte', 'americano', 'cappuccino', 'flat white'],
    question: "Would you like a coffee to go with your cake?",
    fallbackQuestion: "Can I get you a drink with that?",
    priority: 9,
  },
  {
    id: 'cold-drink-snack',
    triggerCategoryKeywords: ['cold drinks', 'juice', 'smoothies'],
    suggestedCategoryKeywords: ['snacks', 'cakes', 'bakery'],
    suggestedItemNameKeywords: ['crisps', 'brownie', 'cookie', 'flapjack'],
    question: "Would you like a snack with your drink?",
    fallbackQuestion: "How about a quick bite with that?",
    priority: 7,
  },
  {
    id: 'any-drink-biscuit',
    triggerCategoryKeywords: ['coffee', 'hot drinks', 'tea', 'cold drinks'],
    suggestedCategoryKeywords: ['bakery', 'snacks'],
    suggestedItemNameKeywords: ['biscuit', 'shortbread', 'cookie', 'flapjack'],
    question: "Would you like a biscuit with that?",
    fallbackQuestion: "How about a little something sweet?",
    priority: 5,
  },
];

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

/**
 * Get scripted upsell suggestions for a trigger item.
 * Returns null if no scripted rule matches.
 */
export function getScriptedUpsell(
  triggerItem: Item,
  cartLines: CartLine[],
  allItems: Item[],
  categoryMap: Map<string, string>,
): UpsellScriptResult | null {
  const itemsInCart = new Set(cartLines.map(line => line.item_id));
  const seenNames = new Set<string>();

  const triggerCategoryName = triggerItem.category_id
    ? (categoryMap.get(triggerItem.category_id) || '').toLowerCase()
    : '';
  const triggerItemName = triggerItem.name.toLowerCase();

  const matchingRules = SCRIPT_RULES
    .filter(rule => {
      const categoryMatch = rule.triggerCategoryKeywords.some(kw =>
        triggerCategoryName.includes(kw) || kw.includes(triggerCategoryName)
      );
      if (!categoryMatch) return false;

      if (rule.excludeItemNameKeywords) {
        const excluded = rule.excludeItemNameKeywords.some(kw =>
          triggerItemName.includes(kw)
        );
        if (excluded) return false;
      }

      if (rule.triggerItemNameKeywords) {
        return rule.triggerItemNameKeywords.some(kw =>
          triggerItemName.includes(kw)
        );
      }

      return true;
    })
    .sort((a, b) => b.priority - a.priority);

  for (const rule of matchingRules) {
    const suggestedItems: UpsellScriptResult['suggestedItems'] = [];

    for (const item of allItems) {
      if (suggestedItems.length >= 6) break;
      if (itemsInCart.has(item.id)) continue;
      if (seenNames.has(item.name)) continue;
      if (item.id === triggerItem.id) continue;

      const itemCategoryName = item.category_id
        ? (categoryMap.get(item.category_id) || '').toLowerCase()
        : '';
      const itemName = item.name.toLowerCase();

      const categoryMatch = rule.suggestedCategoryKeywords.some(kw =>
        itemCategoryName.includes(kw) || kw.includes(itemCategoryName)
      );
      if (!categoryMatch) continue;

      if (rule.suggestedItemNameKeywords) {
        const nameMatch = rule.suggestedItemNameKeywords.some(kw =>
          itemName.includes(kw)
        );
        if (!nameMatch) continue;
      }

      const isGiftOrRetail = itemName.includes('gift') ||
        itemName.includes('retail') ||
        itemName.includes('card') ||
        itemName.includes('merchandise');
      if (isGiftOrRetail) continue;

      seenNames.add(item.name);
      suggestedItems.push({
        ...item,
        suggestion_reason: 'scripted',
      });
    }

    if (suggestedItems.length > 0) {
      const useFallback = suggestedItems.length < 2 && rule.fallbackQuestion;
      return {
        question: useFallback ? rule.fallbackQuestion! : rule.question,
        suggestedItems,
        triggerItemName: triggerItem.name,
      };
    }
  }

  return null;
}

/**
 * Get a checkout-stage upsell prompt based on what's in the cart.
 * Returns a scripted question to ask before payment.
 */
export function getCheckoutUpsellPrompt(
  cartLines: CartLine[],
  allItems: Item[],
  categoryMap: Map<string, string>,
): { question: string; suggestedItems: UpsellScriptResult['suggestedItems'] } | null {
  const itemsInCart = new Set(cartLines.map(line => line.item_id));
  const seenNames = new Set<string>();

  const hasDrink = cartLines.some(line => {
    const cat = line.category_id ? (categoryMap.get(line.category_id) || '').toLowerCase() : '';
    return ['coffee', 'hot drinks', 'tea', 'cold drinks', 'juice', 'smoothies'].some(kw =>
      cat.includes(kw)
    );
  });

  const hasFood = cartLines.some(line => {
    const cat = line.category_id ? (categoryMap.get(line.category_id) || '').toLowerCase() : '';
    return ['sandwiches', 'lunch', 'food', 'breakfast', 'salads', 'wraps', 'paninis'].some(kw =>
      cat.includes(kw)
    );
  });

  const hasSweet = cartLines.some(line => {
    const cat = line.category_id ? (categoryMap.get(line.category_id) || '').toLowerCase() : '';
    return ['cakes', 'bakery', 'pastries', 'desserts'].some(kw =>
      cat.includes(kw)
    );
  });

  if (hasDrink && !hasFood && !hasSweet) {
    const foodItems = allItems.filter(item => {
      if (itemsInCart.has(item.id)) return false;
      if (seenNames.has(item.name)) return false;
      const cat = item.category_id ? (categoryMap.get(item.category_id) || '').toLowerCase() : '';
      return ['sandwiches', 'lunch', 'food', 'breakfast', 'cakes', 'bakery'].some(kw =>
        cat.includes(kw)
      );
    }).slice(0, 4);

    if (foodItems.length > 0) {
      return {
        question: "Would you like something to eat with your drink?",
        suggestedItems: foodItems.map(item => ({ ...item, suggestion_reason: 'scripted' })),
      };
    }
  }

  if (hasFood && !hasDrink) {
    const drinkItems = allItems.filter(item => {
      if (itemsInCart.has(item.id)) return false;
      if (seenNames.has(item.name)) return false;
      const cat = item.category_id ? (categoryMap.get(item.category_id) || '').toLowerCase() : '';
      return ['coffee', 'hot drinks', 'tea', 'cold drinks', 'juice'].some(kw =>
        cat.includes(kw)
      );
    }).slice(0, 4);

    if (drinkItems.length > 0) {
      return {
        question: "Would you like a drink with that?",
        suggestedItems: drinkItems.map(item => ({ ...item, suggestion_reason: 'scripted' })),
      };
    }
  }

  return null;
}
