-- Check if register_settings table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'register_settings';

-- Get all columns in register_settings table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'register_settings'
ORDER BY ordinal_position;

-- Check for data in register_settings
SELECT * FROM register_settings LIMIT 5;
