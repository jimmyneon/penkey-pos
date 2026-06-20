/**
 * Classify a category name into a reporting type for the drink/food split.
 * This is a shared heuristic used by import, reporting, and the POS UI.
 */
export type CategoryType = "drink" | "food" | "retail" | "other";

const DRINK_PATTERNS = [
  "coffee",
  "tea",
  "latte",
  "cappuccino",
  "espresso",
  "americano",
  "mocha",
  "hot chocolate",
  "iced coffee",
  "iced tea",
  "frappe",
  "smoothie",
  "juice",
  "soft drink",
  "soda",
  "water",
  "milkshake",
  "hot drink",
  "cold drink",
  "beverage",
  "lemonade",
  "affogato",
  "drink",
];

const FOOD_PATTERNS = [
  "sandwich",
  "panini",
  "baguette",
  "toast",
  "salad",
  "wrap",
  "breakfast",
  "lunch",
  "pastry",
  "bakery",
  "cake",
  "bake",
  "dessert",
  "brownie",
  "cookie",
  "muffin",
  "croissant",
  "bagel",
  "pancake",
  "waffle",
  "burger",
  "bap",
  "deli",
  "meal",
  "bowl",
  "pizza",
  "snack",
  "hot food",
  "pastie",
  "food",
];

const RETAIL_PATTERNS = [
  "gift",
  "merch",
  "retail",
  "card",
  "mug",
  "t-shirt",
  "cheese",
];

export function classifyCategoryType(name: string): CategoryType {
  const lower = name.toLowerCase();

  if (DRINK_PATTERNS.some((pattern) => lower.includes(pattern))) return "drink";
  if (FOOD_PATTERNS.some((pattern) => lower.includes(pattern))) return "food";
  if (RETAIL_PATTERNS.some((pattern) => lower.includes(pattern))) return "retail";
  return "other";
}

export function getCategoryTypeLabel(type: CategoryType): string {
  switch (type) {
    case "drink":
      return "Drink";
    case "food":
      return "Food";
    case "retail":
      return "Retail";
    case "other":
    default:
      return "Other";
  }
}
