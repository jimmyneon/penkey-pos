-- Add show_online column to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS show_online BOOLEAN DEFAULT FALSE;

-- Create index for faster queries on show_online items
CREATE INDEX IF NOT EXISTS idx_items_show_online ON items(show_online) WHERE show_online = TRUE;
