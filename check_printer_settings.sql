-- Check if printer_settings exist in print_jobs data

-- Show print jobs with printer_settings
SELECT id, printer_id, type, status, attempts, max_attempts,
       CASE WHEN data ? 'printer_settings' THEN 'HAS printer_settings' ELSE 'MISSING printer_settings' END as has_settings,
       data->'printer_settings' as printer_settings
FROM print_jobs
ORDER BY created_at DESC
LIMIT 10;
