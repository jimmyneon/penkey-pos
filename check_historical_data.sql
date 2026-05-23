-- Check how much historical data we have in receipt_lines
SELECT 
  COUNT(*) as total_lines,
  COUNT(DISTINCT receipt_id) as total_receipts,
  MIN(r.created_at) as earliest_receipt,
  MAX(r.created_at) as latest_receipt,
  NOW() - MIN(r.created_at) as data_span
FROM receipt_lines rl
JOIN receipts r ON rl.receipt_id = r.id
WHERE r.org_id = '00000000-0000-0000-0000-000000000001';

-- Check when retail items were added
SELECT 
  i.name,
  c.name as category_name,
  MIN(r.created_at) as first_sold,
  COUNT(DISTINCT r.id) as times_sold
FROM items i
JOIN categories c ON i.category_id = c.id
JOIN receipt_lines rl ON i.id = rl.item_id
JOIN receipts r ON rl.receipt_id = r.id
WHERE i.org_id = '00000000-0000-0000-0000-000000000001'
AND LOWER(c.name) LIKE '%retail%'
GROUP BY i.name, c.name
ORDER BY first_sold ASC;
