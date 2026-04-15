-- Check print_templates table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'print_templates'
ORDER BY ordinal_position;

-- Check if any print templates exist (select all columns)
SELECT *
FROM print_templates
LIMIT 5;
