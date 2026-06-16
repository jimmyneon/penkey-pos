-- Migration 020: Add tip support to receipts/payments + create gift_vouchers table

-- ============================================
-- 1. Add tip_amount to receipts (if not exists)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'receipts' AND column_name = 'tip_amount'
  ) THEN
    ALTER TABLE receipts ADD COLUMN tip_amount NUMERIC(10,2) DEFAULT 0;
  END IF;
END $$;

-- Update tip_total to use tip_amount column if tip_amount is set
-- (tip_total already exists, we just need to keep them in sync via app logic)

-- ============================================
-- 2. Gift Vouchers table
-- ============================================
CREATE TABLE IF NOT EXISTS gift_vouchers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  code TEXT NOT NULL,
  qr_data TEXT NOT NULL,

  -- Voucher type
  voucher_type TEXT NOT NULL DEFAULT 'amount' CHECK (voucher_type IN ('amount', 'item', 'percent')),

  -- Value fields
  amount NUMERIC(10,2),               -- For 'amount' type (e.g. £10.00)
  percent_discount NUMERIC(5,2),      -- For 'percent' type (e.g. 15.00 = 15%)
  item_id UUID,                       -- For 'item' type - links to items table
  item_name TEXT,                     -- Denormalised item name for display

  -- Recipient
  recipient_name TEXT,
  recipient_email TEXT,

  -- Validity
  issued_by UUID,                     -- org_members.id of staff who created it
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired', 'cancelled')),
  redeemed_at TIMESTAMP WITH TIME ZONE,
  redeemed_receipt_id UUID,

  -- Message / notes
  message TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT gift_vouchers_code_org_unique UNIQUE (org_id, code)
);

CREATE INDEX IF NOT EXISTS idx_gift_vouchers_org_id ON gift_vouchers(org_id);
CREATE INDEX IF NOT EXISTS idx_gift_vouchers_code ON gift_vouchers(code);
CREATE INDEX IF NOT EXISTS idx_gift_vouchers_status ON gift_vouchers(status);

-- RLS
ALTER TABLE gift_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on gift_vouchers"
  ON gift_vouchers TO service_role USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_gift_vouchers_updated_at
  BEFORE UPDATE ON gift_vouchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. Orders table (for online/pre-orders)
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  order_number SERIAL,
  source TEXT NOT NULL DEFAULT 'online' CHECK (source IN ('online', 'phone', 'walkin', 'app')),

  -- Customer
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,

  -- Order items (JSONB for flexibility)
  lines JSONB NOT NULL DEFAULT '[]',

  -- Totals
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  tip_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled')),

  -- Scheduling
  requested_for TIMESTAMP WITH TIME ZONE,
  dining_option TEXT DEFAULT 'takeaway' CHECK (dining_option IN ('eat-in', 'takeaway')),
  notes TEXT,

  -- Fulfillment
  accepted_by UUID,                   -- org_members.id
  accepted_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  receipt_id UUID,                    -- Links to receipts once paid

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_org_id ON orders(org_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on orders"
  ON orders TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
