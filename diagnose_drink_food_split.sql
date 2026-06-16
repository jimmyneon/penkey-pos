-- Diagnose why drink/food split is showing 0

-- 1. Check if type column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' AND column_name = 'type'
  ) THEN
    RAISE NOTICE '✓ type column EXISTS in categories table';
  ELSE
    RAISE NOTICE '✗ type column DOES NOT EXIST - need to run migration 019';
  END IF;
END $$;

-- 2. Check current category types (if column exists)
SELECT id, name, type, is_active
FROM categories
ORDER BY name;

-- 3. Check if there are any receipt lines in the date range
SELECT COUNT(*) as total_receipt_lines,
       MIN(r.created_at) as earliest_date,
       MAX(r.created_at) as latest_date
FROM receipt_lines rl
JOIN receipts r ON rl.receipt_id = r.id
WHERE r.status NOT IN ('fully_refunded', 'voided');

-- 4. Sample receipt lines with category info (if type column exists)
SELECT 
  r.id as receipt_id,
  r.created_at,
  rl.name as item_name,
  c.name as category_name,
  c.type as category_type
FROM receipt_lines rl
JOIN items i ON rl.item_id = i.id
JOIN categories c ON i.category_id = c.id
JOIN receipts r ON rl.receipt_id = r.id
WHERE r.status NOT IN ('fully_refunded', 'voided')
ORDER BY r.created_at DESC
LIMIT 10;
