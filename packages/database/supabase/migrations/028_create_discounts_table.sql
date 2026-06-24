-- Discounts table for managing discount codes
-- Supports percentage and fixed amount discounts
-- Can be restricted to specific channels (pos, online, staff)

CREATE TABLE IF NOT EXISTS discounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,

  -- Discount details
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Discount type and value
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Constraints
  min_order_amount NUMERIC(10,2) DEFAULT 0,
  max_discount_amount NUMERIC(10,2),

  -- Usage limits
  usage_limit INTEGER,
  usage_count INTEGER NOT NULL DEFAULT 0,
  one_per_customer BOOLEAN NOT NULL DEFAULT false,

  -- Validity period
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,

  -- Channel restrictions (jsonb array: ["pos", "online", "staff"])
  allowed_channels JSONB NOT NULL DEFAULT '["pos"]'::jsonb,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Audit
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique code per org
  UNIQUE (org_id, code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_discounts_org_id ON discounts(org_id);
CREATE INDEX IF NOT EXISTS idx_discounts_code ON discounts(org_id, code);
CREATE INDEX IF NOT EXISTS idx_discounts_active ON discounts(org_id, is_active);

-- Enable RLS
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as other tables)
CREATE POLICY "Org members can view discounts"
  ON discounts FOR SELECT
  USING (
    org_id IN (
      SELECT id FROM orgs
      WHERE id = discounts.org_id
    )
  );

CREATE POLICY "Org members can manage discounts"
  ON discounts FOR ALL
  USING (
    org_id IN (
      SELECT om.org_id FROM org_members om
      WHERE om.org_id = discounts.org_id
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_discounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_discounts_updated_at ON discounts;
CREATE TRIGGER trigger_discounts_updated_at
  BEFORE UPDATE ON discounts
  FOR EACH ROW
  EXECUTE FUNCTION update_discounts_updated_at();
