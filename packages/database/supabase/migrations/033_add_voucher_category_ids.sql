-- Migration 033: Add category_ids JSONB array to gift_vouchers
-- Allows "Free Item" vouchers to cover multiple categories (e.g. "Free coffee or tea")
-- category_ids stores an array of UUIDs, complementing the existing single category_id

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gift_vouchers' AND column_name = 'category_ids'
  ) THEN
    ALTER TABLE gift_vouchers ADD COLUMN category_ids JSONB;
  END IF;
END $$;
