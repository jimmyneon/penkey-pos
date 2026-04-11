-- Drop table if it exists (in case of previous failed attempts)
DROP TABLE IF EXISTS register_settings CASCADE;

-- Create register_settings table for POS register-specific settings
CREATE TABLE register_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  register_id UUID NOT NULL,
  org_id UUID NOT NULL,

  -- Display preferences
  layout_preference TEXT DEFAULT 'grid' CHECK (layout_preference IN ('grid', 'list')),
  theme TEXT DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  font_size TEXT DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large')),
  grid_size INTEGER DEFAULT 3 CHECK (grid_size IN (2, 3, 4, 5, 6)),

  -- Penkey Prompts settings
  penkey_prompts_enabled BOOLEAN DEFAULT true,
  penkey_auto_dismiss_seconds INTEGER DEFAULT 3,
  penkey_show_popular BOOLEAN DEFAULT true,

  -- Operational preferences
  auto_print_receipt BOOLEAN DEFAULT true,
  print_behaviour TEXT DEFAULT 'always' CHECK (print_behaviour IN ('always', 'ask', 'never')),
  receipt_copies INTEGER DEFAULT 1,
  default_dining_option TEXT DEFAULT 'eat-in' CHECK (default_dining_option IN ('eat-in', 'takeaway')),
  require_customer_name BOOLEAN DEFAULT false,

  -- Sound and feedback
  sound_enabled BOOLEAN DEFAULT true,
  haptic_enabled BOOLEAN DEFAULT true,

  -- Shift management
  shift_management_enabled BOOLEAN DEFAULT true,
  require_opening_cash BOOLEAN DEFAULT true,
  auto_close_shift BOOLEAN DEFAULT false,
  auto_close_time TEXT DEFAULT '23:00',

  -- Additional settings (JSONB for extensibility)
  additional_settings JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint: one settings row per register
  CONSTRAINT unique_register_settings UNIQUE (register_id)
);

-- Create index for faster lookups by register_id
CREATE INDEX IF NOT EXISTS idx_register_settings_register_id ON register_settings(register_id);
CREATE INDEX IF NOT EXISTS idx_register_settings_org_id ON register_settings(org_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_register_settings_updated_at
  BEFORE UPDATE ON register_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE register_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access
CREATE POLICY "Service role full access"
  ON register_settings
  TO service_role
  USING (true)
  WITH CHECK (true);
