-- Create receipt_templates table
CREATE TABLE IF NOT EXISTS receipt_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  header TEXT NOT NULL,
  footer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on org_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_receipt_templates_org_id ON receipt_templates(org_id);

-- Add RLS policies
ALTER TABLE receipt_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read templates for their org
CREATE POLICY "Users can read templates"
ON receipt_templates FOR SELECT
USING (auth.uid() IN (SELECT id FROM users WHERE org_id = receipt_templates.org_id));

-- Policy: Users can create templates for their org
CREATE POLICY "Users can create templates"
ON receipt_templates FOR INSERT
WITH CHECK (
  auth.uid() IN (SELECT id FROM users WHERE org_id = receipt_templates.org_id)
);

-- Policy: Users can update templates for their org
CREATE POLICY "Users can update templates"
ON receipt_templates FOR UPDATE
USING (
  auth.uid() IN (SELECT id FROM users WHERE org_id = receipt_templates.org_id)
);

-- Policy: Users can delete templates for their org
CREATE POLICY "Users can delete templates"
ON receipt_templates FOR DELETE
USING (
  auth.uid() IN (SELECT id FROM users WHERE org_id = receipt_templates.org_id)
);
