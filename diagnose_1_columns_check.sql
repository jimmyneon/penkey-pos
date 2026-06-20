-- Query 1: Check if icon, icon_color, and type columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'categories' 
AND column_name IN ('icon', 'icon_color', 'type')
ORDER BY column_name;
