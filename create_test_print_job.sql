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
      -- Header (left-aligned, print server renders as-is)
      'PENKEY DELICAF' || chr(10)
      || '5 New Street, Lymington' || chr(10)
      || 'WhatsApp Pre-orders: 01590 619472' || chr(10)
      || chr(10)
      -- Divider: exactly 42 dashes
      || '------------------------------------------' || chr(10)
      -- Items: name + spaces + price = exactly 42 printed chars
      -- "1x Ham Baguette"=15 + 22 spaces + "£6.50"=5 = 42
      || '1x Ham Baguette                      ' || chr(163) || '6.50' || chr(10)
      -- "1x Tea"=6 + 31 spaces + "£3.00"=5 = 42
      || '1x Tea                               ' || chr(163) || '3.00' || chr(10)
      -- Divider
      || '------------------------------------------' || chr(10)
      || chr(10)
      -- Totals: left + spaces + price = exactly 42 printed chars
      -- "Subtotal"=8 + 29 spaces + "£9.50"=5 = 42
      || 'Subtotal                             ' || chr(163) || '9.50' || chr(10)
      -- TOTAL bold: ** markers stripped by print server, inner = 42 chars
      -- "TOTAL"=5 + 32 spaces + "£9.50"=5 = 42
      || '**TOTAL                                ' || chr(163) || '9.50**' || chr(10)
      || chr(10)
      || 'Card' || chr(10)
      || to_char(now(), 'DD/MM/YYYY') || ' ' || to_char(now(), 'HH24:MI') || chr(10)
      || 'Transaction ID: abc123xyz' || chr(10)
      || 'Order #1024' || chr(10)
      || 'Eat In - Table 5' || chr(10)
      || chr(10)
      || 'Thank you for visiting'
  ),
  'pending',
  'normal',
  0,
  3,
  now(),
  now();
