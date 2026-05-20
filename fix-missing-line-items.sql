-- Fix Missing Line Items
-- Delete receipts that have no line items so they can be re-imported correctly

-- Step 1: Find receipts with no line items
SELECT 
  r.id,
  r.receipt_number,
  r.created_at,
  r.total,
  COUNT(rl.id) as line_count
FROM receipts r
LEFT JOIN receipt_lines rl ON rl.receipt_id = r.id
WHERE r.org_id = '00000000-0000-0000-0000-000000000001'
GROUP BY r.id, r.receipt_number, r.created_at, r.total
HAVING COUNT(rl.id) = 0
ORDER BY r.created_at DESC
LIMIT 10;

-- Step 2: Delete payments for receipts with no line items
DELETE FROM payments
WHERE receipt_id IN (
  SELECT r.id
  FROM receipts r
  LEFT JOIN receipt_lines rl ON rl.receipt_id = r.id
  WHERE r.org_id = '00000000-0000-0000-0000-000000000001'
  GROUP BY r.id
  HAVING COUNT(rl.id) = 0
);

-- Step 3: Delete receipts with no line items
DELETE FROM receipts
WHERE id IN (
  SELECT r.id
  FROM receipts r
  LEFT JOIN receipt_lines rl ON rl.receipt_id = r.id
  WHERE r.org_id = '00000000-0000-0000-0000-000000000001'
  GROUP BY r.id
  HAVING COUNT(rl.id) = 0
);

-- Step 4: Verify deletion
SELECT 
  (SELECT COUNT(*) FROM receipts WHERE org_id = '00000000-0000-0000-0000-000000000001') as total_receipts,
  (SELECT COUNT(*) FROM receipt_lines WHERE org_id = '00000000-0000-0000-0000-000000000001') as total_lines,
  (SELECT COUNT(*) FROM payments) as total_payments;
