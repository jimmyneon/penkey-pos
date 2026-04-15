-- Fix receipt_templates table to ensure org_id is properly set
-- The original migration references organizations(id) but that table might not exist
-- We need to reference orgs(id) instead

-- Drop the existing foreign key constraint if it exists
ALTER TABLE receipt_templates 
DROP CONSTRAINT IF EXISTS receipt_templates_org_id_fkey;

-- Add the correct foreign key constraint
ALTER TABLE receipt_templates 
ADD CONSTRAINT receipt_templates_org_id_fkey 
FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE;

-- Ensure the column allows NULL temporarily for existing rows
ALTER TABLE receipt_templates 
ALTER COLUMN org_id DROP NOT NULL;

-- Add a default template for each org that doesn't have one
INSERT INTO receipt_templates (org_id, name, header, footer)
SELECT 
  o.id,
  'Default Receipt Template',
  E'PENKEY DÉLICAF\n5 New Street, Lymington\nWhatsApp Pre-orders: 01590 619472',
  'Thank you for visiting'
FROM orgs o
WHERE NOT EXISTS (
  SELECT 1 FROM receipt_templates rt WHERE rt.org_id = o.id
)
ON CONFLICT DO NOTHING;

-- Now make org_id NOT NULL again
ALTER TABLE receipt_templates 
ALTER COLUMN org_id SET NOT NULL;
