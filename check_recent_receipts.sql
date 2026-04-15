-- Check for duplicate receipts created recently
SELECT 
  r.id,
  r.receipt_number,
  r.idempotency_key,
  r.total,
  r.created_at,
  p.metadata->>'transaction_id' as transaction_id
FROM receipts r
LEFT JOIN payments p ON p.receipt_id = r.id
WHERE r.created_at > NOW() - INTERVAL '1 hour'
ORDER BY r.created_at DESC
LIMIT 20;

-- Check if any receipts share the same idempotency_key
SELECT 
  idempotency_key,
  COUNT(*) as count,
  array_agg(receipt_number) as receipt_numbers
FROM receipts
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND idempotency_key IS NOT NULL
GROUP BY idempotency_key
HAVING COUNT(*) > 1;
