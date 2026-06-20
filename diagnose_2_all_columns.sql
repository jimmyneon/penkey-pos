-- Query 2: Show all columns in categories table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'categories'
ORDER BY ordinal_position;
