-- Add favourite_position column to items table for custom ordering of favourites
ALTER TABLE items ADD COLUMN IF NOT EXISTS favourite_position INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_items_favourite_position ON items(favourite_position) WHERE is_favourite = TRUE;
