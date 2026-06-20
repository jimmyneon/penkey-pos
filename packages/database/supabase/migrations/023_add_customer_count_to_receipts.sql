-- Migration 023: Add customer_count to receipts for tracking covers/party size

ALTER TABLE receipts
ADD COLUMN IF NOT EXISTS customer_count INTEGER DEFAULT 1 CHECK (customer_count >= 1 AND customer_count <= 99);

COMMENT ON COLUMN receipts.customer_count IS 'Number of customers/covers for this receipt (default 1)';

CREATE INDEX IF NOT EXISTS idx_receipts_customer_count ON receipts(customer_count);
