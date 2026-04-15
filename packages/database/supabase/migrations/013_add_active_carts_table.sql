-- Create active_carts table for multi-device cart persistence
-- This allows carts to sync across devices in real-time

CREATE TABLE IF NOT EXISTS active_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  register_id UUID REFERENCES registers(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES org_members(id) ON DELETE SET NULL,
  
  -- Cart data stored as JSONB for flexibility
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Metadata
  ticket_assignment JSONB, -- {type: 'table'|'customer', name: string, customer?: object}
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT active_carts_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

-- Index for fast lookups by register
CREATE INDEX IF NOT EXISTS idx_active_carts_register ON active_carts(register_id) WHERE register_id IS NOT NULL;

-- Index for fast lookups by employee
CREATE INDEX IF NOT EXISTS idx_active_carts_employee ON active_carts(employee_id) WHERE employee_id IS NOT NULL;

-- Index for cleanup of old carts
CREATE INDEX IF NOT EXISTS idx_active_carts_last_activity ON active_carts(last_activity_at);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_active_carts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER active_carts_updated_at
  BEFORE UPDATE ON active_carts
  FOR EACH ROW
  EXECUTE FUNCTION update_active_carts_updated_at();

-- Cleanup function to remove old abandoned carts (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_active_carts()
RETURNS void AS $$
BEGIN
  DELETE FROM active_carts
  WHERE last_activity_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON active_carts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON active_carts TO service_role;
