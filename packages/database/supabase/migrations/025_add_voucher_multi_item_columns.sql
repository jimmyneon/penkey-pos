-- Migration 025: Add multi-item and category support to gift_vouchers
-- Allows "Free Item" vouchers to cover:
--   1. Single item (existing item_id column)
--   2. Multiple items (new item_ids JSONB array)
--   3. Whole category (new category_id column)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gift_vouchers' AND column_name = 'item_ids'
  ) THEN
    ALTER TABLE gift_vouchers ADD COLUMN item_ids JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gift_vouchers' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE gift_vouchers ADD COLUMN category_id UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gift_vouchers' AND column_name = 'item_selection_type'
  ) THEN
    ALTER TABLE gift_vouchers ADD COLUMN item_selection_type TEXT DEFAULT 'single'
      CHECK (item_selection_type IN ('single', 'multiple', 'category'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gift_vouchers_category_id ON gift_vouchers(category_id);
