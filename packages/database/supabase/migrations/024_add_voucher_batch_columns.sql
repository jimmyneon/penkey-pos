-- Migration 024: Add batch columns to gift_vouchers for campaign/batch creation
-- Allows creating N vouchers at once (e.g. 10 free coffees) grouped by a batch_id

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gift_vouchers' AND column_name = 'batch_id'
  ) THEN
    ALTER TABLE gift_vouchers ADD COLUMN batch_id UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gift_vouchers' AND column_name = 'batch_label'
  ) THEN
    ALTER TABLE gift_vouchers ADD COLUMN batch_label TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gift_vouchers_batch_id ON gift_vouchers(batch_id);
