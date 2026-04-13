-- Inspect print queue tables to diagnose missing data

-- Check printers table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'printers' 
ORDER BY ordinal_position;

-- Check print_jobs table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'print_jobs' 
ORDER BY ordinal_position;
