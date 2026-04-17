-- Add is_favourite column to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_favourite BOOLEAN DEFAULT FALSE;

-- Create index for faster queries on favourites
CREATE INDEX IF NOT EXISTS idx_items_is_favourite ON items(is_favourite) WHERE is_favourite = TRUE;
