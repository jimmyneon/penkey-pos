-- Backfill printer_settings for existing print jobs
-- This ensures old print jobs have the printer configuration they need

-- Add config column to printers table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printers' AND column_name = 'config'
  ) THEN
    ALTER TABLE printers ADD COLUMN config JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Update all print jobs to include printer_settings from their printer's config
UPDATE print_jobs
SET data = COALESCE(
  data || jsonb_build_object('printer_settings', printers.config),
  data
)
FROM printers
WHERE print_jobs.printer_id = printers.id
AND NOT (data ? 'printer_settings');
