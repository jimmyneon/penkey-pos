-- Check payment metadata for receipt 9a53392e-225b-42b3-8cd9-7c73a4981183
-- This will show us if transaction_id and other SumUp metadata is being stored correctly

SELECT 
  p.id as payment_id,
  p.receipt_id,
  p.method,
  p.amount,
  p.tip_amount,
  p.reference,
  p.metadata,
  p.created_at,
  r.receipt_number,
  r.total as receipt_total,
  r.status as receipt_status
FROM payments p
JOIN receipts r ON p.receipt_id = r.id
WHERE p.receipt_id = '9a53392e-225b-42b3-8cd9-7c73a4981183'
ORDER BY p.created_at;

-- Also check the receipts table for this receipt
SELECT
  id,
  receipt_number,
  total,
  refunded_amount,
  status,
  created_at,
  idempotency_key
FROM receipts
WHERE id = '9a53392e-225b-42b3-8cd9-7c73a4981183';
