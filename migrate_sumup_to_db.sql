-- Migrate SumUp credentials from environment variables to database
-- This will insert the credentials into org_settings for the Penkey org

INSERT INTO org_settings (org_id, settings, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  jsonb_build_object(
    'sumup_credentials', jsonb_build_object(
      'api_key', 'sup_pk_0PwvVddKZ5avKKWoZFAfJhc46PwQkyCi8',
      'merchant_code', 'MD7HX9SL',
      'affiliate_key', '',
      'updated_at', now()
    ),
    'perks', jsonb_build_object(
      'apiKey', 'x/Gh9ScdyiIhxrefaZhWIcaueocGYwrCXEgFa2ufZOA=',
      'domain', 'https://penkey-perks-v2.vercel.app'
    )
  ),
  now(),
  now()
)
ON CONFLICT (org_id) DO UPDATE SET
  settings = jsonb_set(
    org_settings.settings,
    '{sumup_credentials}',
    jsonb_build_object(
      'api_key', 'sup_pk_0PwvVddKZ5avKKWoZFAfJhc46PwQkyCi8',
      'merchant_code', 'MD7HX9SL',
      'affiliate_key', '',
      'updated_at', now()
    )
  ),
  updated_at = now();

-- Verify the migration
SELECT 
  org_id,
  settings->'sumup_credentials' as sumup_creds,
  updated_at
FROM org_settings
WHERE org_id = '00000000-0000-0000-0000-000000000001';
