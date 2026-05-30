-- Run this in Supabase SQL Editor to set category types for existing categories
-- This will improve the drink vs food split accuracy in reports

-- First, check current categories and their types
SELECT id, name, type, org_id
FROM categories
ORDER BY name;

-- Update categories based on their names (customize these for your actual categories)
-- DRINK CATEGORIES
UPDATE categories SET type = 'drink' WHERE LOWER(name) LIKE '%coffee%';
UPDATE categories SET type = 'drink' WHERE LOWER(name) LIKE '%tea%';
UPDATE categories SET type = 'drink' WHERE LOWER(name) LIKE '%latte%';
UPDATE categories SET type = 'drink' WHERE LOWER(name) LIKE '%cappuccino%';
UPDATE categories SET type = 'drink' WHERE LOWER(name) LIKE '%espresso%';
UPDATE categories SET type = 'drink' WHERE LOWER(name) LIKE '%americano%';
UPDATE categories SET type = 'drink' WHERE LOWER(name) LIKE '%mocha%';
UPDATE categories SET type = 'drink' WHERE LOWER(name) LIKE '%hot chocolate%';
UPDATE categories SET type = 'drink' WHERE LOWER(name) LIKE '%iced coffee%';
UPDATE categories SET type = 'drink' WHERE LOWER(name) LIKE '%iced tea%';
UPDATE categories SET type = 'drink' WHERE LOWER(name) LIKE '%frappe%';
UPDATE categories SET type = 'drink' WHERE LOWER(name) LIKE '%smoothie%';
UPDATE categories SET type = 'drink' WHERE LOWER(name) LIKE '%juice%';
UPDATE categories SET type = 'drink' WHERE LOWER(name) LIKE '%soft drink%';
UPDATE categories SET type = 'drink' WHERE LOWER(name) LIKE '%soda%';
UPDATE categories SET type = 'drink' WHERE LOWER(name) LIKE '%water%';
UPDATE categories SET type = 'drink' WHERE LOWER(name) LIKE '%hot drinks%';
UPDATE categories SET type = 'drink' WHERE LOWER(name) LIKE '%cold drinks%';
UPDATE categories SET type = 'drink' WHERE LOWER(name) LIKE '%beverage%';
UPDATE categories SET type = 'drink' WHERE LOWER(name) LIKE '%drink%';

-- FOOD CATEGORIES
UPDATE categories SET type = 'food' WHERE LOWER(name) LIKE '%sandwich%';
UPDATE categories SET type = 'food' WHERE LOWER(name) LIKE '%panini%';
UPDATE categories SET type = 'food' WHERE LOWER(name) LIKE '%baguette%';
UPDATE categories SET type = 'food' WHERE LOWER(name) LIKE '%toast%';
UPDATE categories SET type = 'food' WHERE LOWER(name) LIKE '%salad%';
UPDATE categories SET type = 'food' WHERE LOWER(name) LIKE '%wrap%';
UPDATE categories SET type = 'food' WHERE LOWER(name) LIKE '%breakfast%';
UPDATE categories SET type = 'food' WHERE LOWER(name) LIKE '%lunch%';
UPDATE categories SET type = 'food' WHERE LOWER(name) LIKE '%pastry%';
UPDATE categories SET type = 'food' WHERE LOWER(name) LIKE '%bakery%';
UPDATE categories SET type = 'food' WHERE LOWER(name) LIKE '%cake%';
UPDATE categories SET type = 'food' WHERE LOWER(name) LIKE '%dessert%';
UPDATE categories SET type = 'food' WHERE LOWER(name) LIKE '%brownie%';
UPDATE categories SET type = 'food' WHERE LOWER(name) LIKE '%cookie%';
UPDATE categories SET type = 'food' WHERE LOWER(name) LIKE '%muffin%';
UPDATE categories SET type = 'food' WHERE LOWER(name) LIKE '%croissant%';
UPDATE categories SET type = 'food' WHERE LOWER(name) LIKE '%bagel%';
UPDATE categories SET type = 'food' WHERE LOWER(name) LIKE '%pancake%';
UPDATE categories SET type = 'food' WHERE LOWER(name) LIKE '%waffle%';
UPDATE categories SET type = 'food' WHERE LOWER(name) LIKE '%burger%';
UPDATE categories SET type = 'food' WHERE LOWER(name) LIKE '%pizza%';
UPDATE categories SET type = 'food' WHERE LOWER(name) LIKE '%food%';

-- RETAIL CATEGORIES
UPDATE categories SET type = 'retail' WHERE LOWER(name) LIKE '%gift%';
UPDATE categories SET type = 'retail' WHERE LOWER(name) LIKE '%merch%';
UPDATE categories SET type = 'retail' WHERE LOWER(name) LIKE '%retail%';
UPDATE categories SET type = 'retail' WHERE LOWER(name) LIKE '%card%';
UPDATE categories SET type = 'retail' WHERE LOWER(name) LIKE '%mug%';
UPDATE categories SET type = 'retail' WHERE LOWER(name) LIKE '%t-shirt%';

-- Verify the updates
SELECT id, name, type, org_id
FROM categories
ORDER BY type, name;
