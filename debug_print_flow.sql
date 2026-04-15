-- Check what's actually in the print_templates table
SELECT id, name, type, template, is_default, created_at
FROM print_templates
WHERE org_id = '00000000-0000-0000-0000-000000000001'
  AND type = 'receipt';

-- Check if there are multiple templates (might be using wrong one)
SELECT id, name, type, is_default, 
       substring(template, 1, 50) as template_preview
FROM print_templates
WHERE org_id = '00000000-0000-0000-0000-000000000001';
