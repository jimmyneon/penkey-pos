-- Migration 034: Add min_spend column to gift_vouchers
-- Allows vouchers to have a minimum spend condition (e.g. "Spend over £10 to use this voucher")
-- Applies to amount and percent voucher types

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gift_vouchers' AND column_name = 'min_spend'
  ) THEN
    ALTER TABLE gift_vouchers ADD COLUMN min_spend NUMERIC(10,2) DEFAULT 0;
  END IF;
END $$;
