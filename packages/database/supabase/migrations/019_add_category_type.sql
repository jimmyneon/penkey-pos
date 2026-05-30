-- Add type column to categories table for better drink/food classification
-- This allows explicit categorization instead of pattern matching

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'other' CHECK (type IN ('drink', 'food', 'retail', 'other'));

-- Add comment
COMMENT ON COLUMN categories.type IS 'Category type for reporting: drink, food, retail, or other';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);
