-- Delete all Loyverse imported receipts (receipt numbers starting with "3-")
-- This allows us to re-import them correctly with line items

-- Step 1: Delete payments for Loyverse receipts
DELETE FROM payments
WHERE receipt_id IN (
  SELECT id FROM receipts 
  WHERE org_id = '00000000-0000-0000-0000-000000000001'
  AND receipt_number LIKE '3-%'
);

-- Step 2: Delete receipt lines for Loyverse receipts
DELETE FROM receipt_lines
WHERE receipt_id IN (
  SELECT id FROM receipts 
  WHERE org_id = '00000000-0000-0000-0000-000000000001'
  AND receipt_number LIKE '3-%'
);

-- Step 3: Delete Loyverse receipts
DELETE FROM receipts
WHERE org_id = '00000000-0000-0000-0000-000000000001'
AND receipt_number LIKE '3-%';

-- Step 4: Verify deletion
SELECT 
  (SELECT COUNT(*) FROM receipts WHERE org_id = '00000000-0000-0000-0000-000000000001') as remaining_receipts,
  (SELECT COUNT(*) FROM receipt_lines WHERE org_id = '00000000-0000-0000-0000-000000000001') as remaining_lines,
  (SELECT COUNT(*) FROM payments) as remaining_payments;
