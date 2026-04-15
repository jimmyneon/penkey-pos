-- Test if template updates are working
-- First, check current template
SELECT id, name, template, updated_at 
FROM print_templates 
WHERE org_id = '00000000-0000-0000-0000-000000000001' 
  AND type = 'receipt';

-- Try a manual update to test
UPDATE print_templates 
SET template = 'TEST HEADER LINE 1
TEST HEADER LINE 2
TEST HEADER LINE 3',
    updated_at = NOW()
WHERE org_id = '00000000-0000-0000-0000-000000000001' 
  AND type = 'receipt';

-- Check if it updated
SELECT id, name, template, updated_at 
FROM print_templates 
WHERE org_id = '00000000-0000-0000-0000-000000000001' 
  AND type = 'receipt';
