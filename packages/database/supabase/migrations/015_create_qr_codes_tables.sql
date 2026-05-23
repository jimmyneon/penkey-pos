-- Create qr_codes table for managing QR codes
CREATE TABLE IF NOT EXISTS qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  
  -- QR code details
  code_type TEXT NOT NULL CHECK (code_type IN ('google_review', 'website', 'custom')),
  name TEXT NOT NULL,
  target_url TEXT NOT NULL,
  unique_code TEXT NOT NULL UNIQUE, -- Short code for tracking URL
  
  -- Configuration
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb, -- Size, color, logo, etc.
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_qr_codes_org ON qr_codes(org_id);
CREATE INDEX idx_qr_codes_store ON qr_codes(store_id);
CREATE INDEX idx_qr_codes_unique ON qr_codes(unique_code);
CREATE INDEX idx_qr_codes_type ON qr_codes(code_type);

-- Create qr_scans table for tracking QR code scans
CREATE TABLE IF NOT EXISTS qr_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id UUID NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  
  -- Scan details
  receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL, -- Optional: linked to transaction
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  
  -- Tracking data
  user_agent TEXT,
  ip_address TEXT, -- Optional: for analytics
  referrer TEXT,
  
  -- Timestamp
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_qr_scans_qr_code ON qr_scans(qr_code_id);
CREATE INDEX idx_qr_scans_receipt ON qr_scans(receipt_id);
CREATE INDEX idx_qr_scans_store ON qr_scans(store_id);
CREATE INDEX idx_qr_scans_date ON qr_scans(scanned_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_qr_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for qr_codes
CREATE TRIGGER qr_codes_updated_at
  BEFORE UPDATE ON qr_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_qr_codes_updated_at();

-- Enable Row Level Security
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_scans ENABLE ROW LEVEL SECURITY;

-- Create policies for qr_codes
CREATE POLICY "Users can read own org qr codes" ON qr_codes
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create qr codes for own org" ON qr_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own org qr codes" ON qr_codes
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own org qr codes" ON qr_codes
  FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Create policies for qr_scans
CREATE POLICY "Users can read own org qr scans" ON qr_scans
  FOR SELECT
  TO authenticated
  USING (
    qr_code_id IN (
      SELECT id FROM qr_codes WHERE org_id IN (
        SELECT org_id FROM org_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Service role full access on qr_codes" ON qr_codes
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on qr_scans" ON qr_scans
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE qr_codes IS 'QR codes for reviews, websites, and custom campaigns with tracking';
COMMENT ON COLUMN qr_codes.unique_code IS 'Short unique code used in tracking URLs (e.g., /qr/ABC123)';
COMMENT ON COLUMN qr_codes.config IS 'JSON config for QR code appearance: size, color, logo, etc.';

COMMENT ON TABLE qr_scans IS 'Tracking data for QR code scans';
COMMENT ON COLUMN qr_scans.receipt_id IS 'Optional: links scan to specific receipt for transaction-based tracking';
COMMENT ON COLUMN qr_scans.ip_address IS 'Optional: IP address for analytics (privacy consideration)';
