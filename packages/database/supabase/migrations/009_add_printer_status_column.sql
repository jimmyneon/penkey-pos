-- Add status column to printers table
ALTER TABLE printers 
ADD COLUMN status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'error'));

-- Update existing printers to offline
UPDATE printers SET status = 'offline' WHERE status IS NULL;
