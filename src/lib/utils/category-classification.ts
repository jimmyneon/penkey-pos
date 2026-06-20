/**
 * Classify a category name into a reporting type for the drink/food split.
 * This is a shared heuristic used by import, reporting, and the POS UI.
 */
export type CategoryType = "drink" | "food" | "retail" | "other";
export type FoodSubtype = "sweet" | "lunch" | "other_food";

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

const SWEET_TREAT_PATTERNS = [
  "cake",
  "brownie",
  "cookie",
  "muffin",
  "croissant",
  "pastry",
  "bake",
  "bakes",
  "sweet",
  "dessert",
  "waffle",
  "pancake",
  "scone",
  "flapjack",
  "shortbread",
  "donut",
  "doughnut",
  "tart",
  "slice",
  "crumble",
  "biscuit",
  "tray bake",
  "fruit cake",
  "bakery",
  "chocolate",
  "cinnamon",
  "apple",
  "lemon crumble",
];

const LUNCH_PATTERNS = [
  "sandwich",
  "panini",
  "baguette",
  "toastie",
  "toast",
  "salad",
  "wrap",
  "breakfast",
  "lunch",
  "burger",
  "bap",
  "deli",
  "meal",
  "bowl",
  "pizza",
  "pastie",
  "pasty",
  "soup",
  "macaroni",
  "pasta",
  "quiche",
  "pie",
  "roll",
  "sub",
  "melt",
  "sausage roll",
  "hogs loaf",
  "hog's loaf",
  "cobbler",
  "terrine",
  "ploughman",
  "blt",
  "ham",
  "egg",
  "chicken",
  "houmous",
  "full penkey",
  "pulled pork",
  "cheese and onion",
  "bacon",
  "sausage bap",
  "sausage loaf",
  "hot food",
  "food",
];

export function classifyFoodSubtype(name: string): FoodSubtype {
  const lower = name.toLowerCase();

  if (LUNCH_PATTERNS.some((pattern) => lower.includes(pattern))) return "lunch";
  if (SWEET_TREAT_PATTERNS.some((pattern) => lower.includes(pattern))) return "sweet";
  return "other_food";
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
