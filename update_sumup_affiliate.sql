-- Update SumUp credentials with new affiliate key
UPDATE org_settings
SET settings = jsonb_set(
  settings,
  '{sumup_credentials,affiliate_key}',
  '"sup_afk_SfQcDbZq15H6pTa1Uww5NpHejGC3Hac2"'
),
updated_at = now()
WHERE org_id = '00000000-0000-0000-0000-000000000001';

-- Verify the update
SELECT 
  org_id,
  settings->'sumup_credentials' as sumup_creds,
  updated_at
FROM org_settings
WHERE org_id = '00000000-0000-0000-0000-000000000001';
