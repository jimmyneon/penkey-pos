-- Add is_reusable column to gift_vouchers table
-- Custom code vouchers (pre-printed) can be reused multiple times
-- Auto-generated PNK- vouchers remain one-time use only

ALTER TABLE gift_vouchers
ADD COLUMN IF NOT EXISTS is_reusable BOOLEAN NOT NULL DEFAULT false;

-- Mark all existing vouchers with custom codes (non-PNK prefix) as reusable
UPDATE gift_vouchers
SET is_reusable = true
WHERE code NOT LIKE 'PNK-%';
