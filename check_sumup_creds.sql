-- Check if SumUp credentials exist in org_settings
SELECT 
  org_id,
  settings->'sumup_credentials' as sumup_creds
FROM org_settings
WHERE settings->'sumup_credentials' IS NOT NULL;
