-- Migration 026: Add voucher_title column to gift_vouchers
-- Allows custom display text on free item vouchers (e.g. "Choose Any Free Coffee")
-- instead of showing the raw item name. Items are still linked for redemption validation.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gift_vouchers' AND column_name = 'voucher_title'
  ) THEN
    ALTER TABLE gift_vouchers ADD COLUMN voucher_title TEXT;
  END IF;
END $$;
