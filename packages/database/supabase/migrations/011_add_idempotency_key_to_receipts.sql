-- Add idempotency_key column to receipts table for duplicate prevention
-- This column stores the temp receipt ID used as an idempotency key to prevent duplicate receipts

ALTER TABLE receipts ADD COLUMN IF NOT EXISTS idempotency_key UUID;

-- Create unique index on idempotency_key to enforce uniqueness at database level
-- This prevents race conditions where multiple requests with same key arrive simultaneously
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_idempotency_key 
ON receipts(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_receipts_idempotency_key_lookup 
ON receipts(idempotency_key);

-- Add comment explaining the column
COMMENT ON COLUMN receipts.idempotency_key IS 'Unique key from client (temp receipt ID) used to prevent duplicate receipt creation. NULL for receipts created before this feature.';
