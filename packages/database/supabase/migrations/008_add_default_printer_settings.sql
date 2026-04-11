-- Add default printer settings to all printers
-- These are the settings that last worked on the print server

UPDATE printers
SET config = '{"code_page": 2, "feed_lines_before_cut": 6, "width": 58}'::jsonb
WHERE config = '{}'::jsonb OR config IS NULL;
