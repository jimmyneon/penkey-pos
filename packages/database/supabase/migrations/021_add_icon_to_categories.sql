-- Migration 021: Add icon and icon_color columns to categories
-- These columns are required by the categories API select query but were missing from the schema,
-- causing a 500 error on GET /api/categories and blocking all category/item loading.

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'UtensilsCrossed';

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS icon_color TEXT DEFAULT '#ffffff';

COMMENT ON COLUMN categories.icon IS 'Lucide icon name for the category (e.g. UtensilsCrossed, Coffee)';
COMMENT ON COLUMN categories.icon_color IS 'Icon foreground colour as a hex string (e.g. #ffffff)';
