-- Add missing columns to existing discounts table
-- The table already existed before migration 028 (which used CREATE TABLE IF NOT EXISTS = no-op)
-- Existing columns: id, org_id, name, type, value, applies_to, conditions, is_active, valid_from, valid_until, created_at, updated_at

-- 1. Delete duplicate rows (keep the oldest by created_at)
DELETE FROM discounts
WHERE id NOT IN (
  SELECT DISTINCT ON (name, type, value) id
  FROM discounts
  ORDER BY name, type, value, created_at ASC
);

-- 2. Add missing columns
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS usage_limit INTEGER;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS one_per_customer BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC(10,2);
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS allowed_channels JSONB NOT NULL DEFAULT '["pos"]'::jsonb;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS created_by UUID;

-- 3. Backfill codes from name (now unique after dedup)
UPDATE discounts SET code = UPPER(REPLACE(name, ' ', '')) WHERE code IS NULL;

-- 4. Create unique index (will work now that dupes are gone)
CREATE UNIQUE INDEX IF NOT EXISTS idx_discounts_code_unique ON discounts(org_id, code) WHERE code IS NOT NULL;
