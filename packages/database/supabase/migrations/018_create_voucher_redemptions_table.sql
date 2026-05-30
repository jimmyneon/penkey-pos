-- Track voucher redemptions for reporting
CREATE TABLE IF NOT EXISTS voucher_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL,
  voucher_id TEXT NOT NULL, -- Perks voucher ID
  voucher_name TEXT NOT NULL,
  discount_type TEXT NOT NULL, -- 'percentage', 'fixed', 'free_item', 'free_modifier'
  discount_value DECIMAL(10,2) NOT NULL,
  bean_cost INTEGER NOT NULL,
  item_type TEXT, -- e.g., 'coffee', 'tea', 'milkshake', 'sandwich', 'modifier'
  category TEXT, -- e.g., 'drink', 'food', 'modifier'
  customer_id TEXT, -- Perks customer ID
  customer_name TEXT,
  staff_id UUID REFERENCES org_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT org_id_not_null CHECK (org_id IS NOT NULL)
);

-- Index for reporting
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_org_id ON voucher_redemptions(org_id);
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_receipt_id ON voucher_redemptions(receipt_id);
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_created_at ON voucher_redemptions(created_at);
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_voucher_id ON voucher_redemptions(voucher_id);

-- Add comment
COMMENT ON TABLE voucher_redemptions IS 'Tracks voucher redemptions for reporting and analytics';
