-- Update font_size CHECK constraint to include very_small option
ALTER TABLE register_settings 
DROP CONSTRAINT IF EXISTS register_settings_font_size_check;

ALTER TABLE register_settings 
ADD CONSTRAINT register_settings_font_size_check 
CHECK (font_size IN ('very_small', 'small', 'medium', 'large'));
