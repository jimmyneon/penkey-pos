-- Migration 027: Add voucher_template_layout to org_settings
-- Stores the configurable voucher layout (text positions, font sizes, colors)
-- as a JSONB object within the existing org_settings table.
-- No new table needed — org_settings already has a JSONB settings column.

-- The layout config is stored as org_settings.settings.voucher_template_layout
-- and managed via the /api/voucher-template-settings endpoint.
-- If no layout is stored, the app falls back to DEFAULT_VOUCHER_LAYOUT
-- (matching the original hardcoded positions).

-- No schema changes needed — just documenting the convention.
-- The frontend reads/writes via:
--   GET  /api/voucher-template-settings  → returns { layout: {...} }
--   POST /api/voucher-template-settings  → saves { layout: {...} }
