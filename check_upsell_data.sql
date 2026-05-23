-- Check for any existing upsell-related tables or data
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%upsell%' OR table_name LIKE '%association%');

-- Check receipt_lines table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'receipt_lines'
ORDER BY ordinal_position;

-- Check if any functions exist for upsell calculations
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND (routine_name LIKE '%upsell%' OR routine_name LIKE '%association%' OR routine_name LIKE '%frequently%');

-- Sample receipt_lines data to understand structure
SELECT * FROM receipt_lines LIMIT 5;

-- Check categories table for Gifts category
SELECT id, name FROM categories WHERE LOWER(name) LIKE '%gift%';

-- Check items in Gifts category
SELECT i.id, i.name, c.name as category_name
FROM items i
JOIN categories c ON i.category_id = c.id
WHERE LOWER(c.name) LIKE '%gift%'
LIMIT 10;
