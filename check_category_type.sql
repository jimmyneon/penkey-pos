-- Check if the type column exists in categories table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'categories'
  AND column_name = 'type';

-- If the above returns nothing, the column doesn't exist - run the migration
-- If it returns data, check current category types
SELECT id, name, type, is_active
FROM categories
ORDER BY name;
