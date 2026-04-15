-- Fix the É character encoding issue in receipt template
-- Change DÉLICAF to DELICAF to avoid encoding problems

UPDATE print_templates 
SET template = E'PENKEY DELICAF\n5 New Street, Lymington\nWhatsApp Pre-orders: 01590 619472'
WHERE org_id = '00000000-0000-0000-0000-000000000001';
