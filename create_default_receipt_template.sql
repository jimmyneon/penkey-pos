-- Create a default receipt template for your org
-- Replace 'YOUR_ORG_ID_HERE' with your actual org_id

INSERT INTO print_templates (org_id, name, type, template, paper_width, is_default)
VALUES (
  'YOUR_ORG_ID_HERE',  -- Replace with your org_id from orgs table
  'Default Receipt Template',
  'receipt',
  E'PENKEY DÉLICAF\n5 New Street, Lymington\nWhatsApp Pre-orders: 01590 619472',
  80,
  true
);

-- To find your org_id, run this first:
-- SELECT id, name FROM orgs;
