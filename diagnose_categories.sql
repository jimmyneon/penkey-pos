-- Diagnostic queries for categories table issue
-- Run this in Supabase SQL Editor and share the results

-- 1. Check if icon, icon_color, and type columns exist in categories table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'categories' 
AND column_name IN ('icon', 'icon_color', 'type')
ORDER BY column_name;

-- 2. Show all columns in categories table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'categories'
ORDER BY ordinal_position;

-- 3. Check if there are any categories in the table
SELECT COUNT(*) as category_count FROM categories;

-- 4. Sample a few categories to see their structure
SELECT * FROM categories LIMIT 3;
