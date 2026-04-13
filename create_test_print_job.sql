-- Create a test print job
-- receipt_text is built exactly as the app's generateReceiptText() would produce it.
-- printer_settings tell the print server which hardware commands to apply.
INSERT INTO print_jobs (
  id,
  org_id,
  printer_id,
  type,
  data,
  status,
  priority,
  attempts,
  max_attempts,
  created_at,
  updated_at
) SELECT
  gen_random_uuid(),
  (SELECT id FROM orgs LIMIT 1),
  '00000000-0000-0000-0000-0000000000a0',
  'receipt',
  jsonb_build_object(
    'printer_settings', jsonb_build_object(
      'code_page', 19,
      'feed_lines_before_cut', 6,
      'width', 42
    ),
    'receipt_text',
      'PENKEY DELICAF' || chr(10)
      || '5 New Street, Lymington' || chr(10)
      || 'WhatsApp Pre-orders: 01590 619472' || chr(10)
      || chr(10)
      || '------------------------------------------' || chr(10)
      || '1x Ham Baguette                    £6.50' || chr(10)
      || '1x Tea                             £3.00' || chr(10)
      || '------------------------------------------' || chr(10)
      || chr(10)
      || 'Subtotal                           £9.50' || chr(10)
      || '**TOTAL                            £9.50**' || chr(10)
      || chr(10)
      || 'Card' || chr(10)
      || to_char(now(), 'DD/MM/YYYY') || ' ' || to_char(now(), 'HH24:MI') || chr(10)
      || 'Order #1024' || chr(10)
      || chr(10)
      || 'Thank you for visiting'
  ),
  'pending',
  'normal',
  0,
  3,
  now(),
  now();
