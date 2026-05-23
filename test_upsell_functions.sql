-- Test the upsell functions to verify they're working correctly

-- Test 1: Check if functions exist
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND (routine_name LIKE '%upsell%' OR routine_name LIKE '%association%' OR routine_name LIKE '%frequently%');

-- Test 2: Test calculate_item_associations with your org
-- This should return item pairs that appear together frequently
SELECT * FROM calculate_item_associations(
  p_org_id := '00000000-0000-0000-0000-000000000001',
  p_days_back := 90,
  p_min_frequency := 5,
  p_min_confidence := 0.2
)
LIMIT 10;

-- Test 3: Test get_frequently_bought_together with a specific item
-- First, get a valid item ID from your items table
SELECT id, name FROM items 
WHERE org_id = '00000000-0000-0000-0000-000000000001' 
AND is_active = true
LIMIT 5;

-- Then test with one of those item IDs (replace with actual ID from above)
-- SELECT * FROM get_frequently_bought_together(
--   p_org_id := '00000000-0000-0000-0000-000000000001',
--   p_item_id := 'YOUR_ITEM_ID_HERE',
--   p_days_back := 90,
--   p_limit := 3
-- );

-- Test 4: Check receipt_lines table has data
SELECT COUNT(*) as total_lines, 
       COUNT(DISTINCT receipt_id) as total_receipts,
       MIN(created_at) as earliest_date,
       MAX(created_at) as latest_date
FROM receipt_lines
WHERE org_id = '00000000-0000-0000-0000-000000000001';

-- Test 5: Check if there are any items in Gifts/Retail categories
SELECT i.id, i.name, c.name as category_name
FROM items i
JOIN categories c ON i.category_id = c.id
WHERE i.org_id = '00000000-0000-0000-0000-000000000001'
AND (LOWER(c.name) LIKE '%gift%' OR LOWER(c.name) LIKE '%retail%')
LIMIT 10;
