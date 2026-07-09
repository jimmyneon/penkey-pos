/**
 * Check if cart/order lines contain any food items.
 * Uses category classification heuristic to distinguish food from drinks.
 */

import { classifyCategoryType } from "./category-classification";

export interface ClassifiableLine {
  item_name: string;
  category_id?: string | null;
  category_name?: string | null;
}

/**
 * Returns true if any line is classified as food.
 * Uses category_name if available, falls back to item_name.
 */
export function containsFoodItems(
  lines: ClassifiableLine[],
  categoryMap?: Map<string, string>
): boolean {
  return lines.some((line) => {
    let nameToClassify = "";
    if (line.category_id && categoryMap) {
      nameToClassify = categoryMap.get(line.category_id) || "";
    }
    if (!nameToClassify && line.category_name) {
      nameToClassify = line.category_name;
    }
    if (!nameToClassify) {
      nameToClassify = line.item_name;
    }
    return classifyCategoryType(nameToClassify) === "food";
  });
}
