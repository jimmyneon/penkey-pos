-- Check for SumUp credentials in org_settings
SELECT 
  org_id,
  settings->'sumup_credentials' as sumup_creds,
  created_at,
  updated_at
FROM org_settings
WHERE settings->'sumup_credentials' IS NOT NULL;

-- Check for SumUp credentials in register_settings (old location)
SELECT 
  id,
  register_id,
  additional_settings->'sumup_credentials' as sumup_creds,
  created_at,
  updated_at
FROM register_settings
WHERE additional_settings->'sumup_credentials' IS NOT NULL;

-- Check all org_settings to see structure
SELECT 
  org_id,
  settings,
  created_at,
  updated_at
FROM org_settings;

-- Check all register_settings to see structure
SELECT 
  id,
  register_id,
  additional_settings,
  created_at,
  updated_at
FROM register_settings;
