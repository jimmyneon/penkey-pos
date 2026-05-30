-- Check if affiliate key is in the database
SELECT 
  org_id,
  settings->'sumup_credentials' as sumup_creds
FROM org_settings
WHERE org_id = '00000000-0000-0000-0000-000000000001';
