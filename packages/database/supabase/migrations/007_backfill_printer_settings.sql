-- Backfill printer_settings for existing print jobs
-- This ensures old print jobs have the printer configuration they need

-- Update all print jobs to include printer_settings from their printer's config
UPDATE print_jobs
SET data = COALESCE(
  data || jsonb_build_object('printer_settings', printers.config),
  data
)
FROM printers
WHERE print_jobs.printer_id = printers.id
AND NOT (data ? 'printer_settings');
