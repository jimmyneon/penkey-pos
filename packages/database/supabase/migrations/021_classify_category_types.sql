-- One-time migration to classify existing categories by name for drink/food split reporting.
-- This is idempotent: it only touches categories whose type is currently 'other' or null.

-- Ensure any categories with no type get the default first
UPDATE categories
SET type = 'other'
WHERE type IS NULL;

-- Classify drink categories
UPDATE categories
SET type = 'drink'
WHERE type IN ('other', NULL)
  AND (
    LOWER(name) LIKE '%coffee%'
    OR LOWER(name) LIKE '%tea%'
    OR LOWER(name) LIKE '%latte%'
    OR LOWER(name) LIKE '%cappuccino%'
    OR LOWER(name) LIKE '%espresso%'
    OR LOWER(name) LIKE '%americano%'
    OR LOWER(name) LIKE '%mocha%'
    OR LOWER(name) LIKE '%hot chocolate%'
    OR LOWER(name) LIKE '%iced coffee%'
    OR LOWER(name) LIKE '%iced tea%'
    OR LOWER(name) LIKE '%frappe%'
    OR LOWER(name) LIKE '%smoothie%'
    OR LOWER(name) LIKE '%juice%'
    OR LOWER(name) LIKE '%soft drink%'
    OR LOWER(name) LIKE '%soda%'
    OR LOWER(name) LIKE '%water%'
    OR LOWER(name) LIKE '%milkshake%'
    OR LOWER(name) LIKE '%hot drink%'
    OR LOWER(name) LIKE '%cold drink%'
    OR LOWER(name) LIKE '%beverage%'
    OR LOWER(name) LIKE '%lemonade%'
    OR LOWER(name) LIKE '%affogato%'
    OR LOWER(name) LIKE '%drink%'
  );

-- Classify food categories
UPDATE categories
SET type = 'food'
WHERE type IN ('other', NULL)
  AND (
    LOWER(name) LIKE '%sandwich%'
    OR LOWER(name) LIKE '%panini%'
    OR LOWER(name) LIKE '%baguette%'
    OR LOWER(name) LIKE '%toast%'
    OR LOWER(name) LIKE '%salad%'
    OR LOWER(name) LIKE '%wrap%'
    OR LOWER(name) LIKE '%breakfast%'
    OR LOWER(name) LIKE '%lunch%'
    OR LOWER(name) LIKE '%pastry%'
    OR LOWER(name) LIKE '%bakery%'
    OR LOWER(name) LIKE '%cake%'
    OR LOWER(name) LIKE '%bake%'
    OR LOWER(name) LIKE '%dessert%'
    OR LOWER(name) LIKE '%brownie%'
    OR LOWER(name) LIKE '%cookie%'
    OR LOWER(name) LIKE '%muffin%'
    OR LOWER(name) LIKE '%croissant%'
    OR LOWER(name) LIKE '%bagel%'
    OR LOWER(name) LIKE '%pancake%'
    OR LOWER(name) LIKE '%waffle%'
    OR LOWER(name) LIKE '%burger%'
    OR LOWER(name) LIKE '%bap%'
    OR LOWER(name) LIKE '%deli%'
    OR LOWER(name) LIKE '%meal%'
    OR LOWER(name) LIKE '%bowl%'
    OR LOWER(name) LIKE '%pizza%'
    OR LOWER(name) LIKE '%snack%'
    OR LOWER(name) LIKE '%hot food%'
    OR LOWER(name) LIKE '%pastie%'
    OR LOWER(name) LIKE '%food%'
  );

-- Classify retail categories
UPDATE categories
SET type = 'retail'
WHERE type IN ('other', NULL)
  AND (
    LOWER(name) LIKE '%gift%'
    OR LOWER(name) LIKE '%merch%'
    OR LOWER(name) LIKE '%retail%'
    OR LOWER(name) LIKE '%card%'
    OR LOWER(name) LIKE '%mug%'
    OR LOWER(name) LIKE '%t-shirt%'
    OR LOWER(name) LIKE '%cheese%'
  );

-- Verify the results
SELECT id, name, type, is_active
FROM categories
ORDER BY type, name;
