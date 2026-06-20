-- Add type column to categories table (migration 019)
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'other' CHECK (type IN ('drink', 'food', 'retail', 'other'));

COMMENT ON COLUMN categories.type IS 'Category type for reporting: drink, food, retail, or other';

CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);
