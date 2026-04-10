-- Check refunds table schema to debug 500 error
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'refunds'
ORDER BY ordinal_position;
