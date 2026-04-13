-- Create a test print job with updated receipt data
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
    'store_name', 'Penkey Délicaf & Gifts',
    'store_address', '123 Test Street',
    'receipt_number', 12345,
    'date', to_char(now(), 'DD/MM/YYYY'),
    'time', to_char(now(), 'HH24:MI'),
    'employee_name', 'Test Staff',
    'register_name', 'Main Till',
    'lines', jsonb_build_array(
      jsonb_build_object(
        'quantity', 1,
        'item_name', 'Test Item',
        'variant_name', null,
        'modifiers', '[]'::jsonb,
        'line_total', 5.00
      )
    ),
    'subtotal', 5.00,
    'tax', 1.00,
    'total', 6.00,
    'payment_method', 'cash',
    'cash_tendered', 10.00,
    'cash_change', 4.00,
    'printer_settings', jsonb_build_object(
      'code_page', 19,
      'feed_lines_before_cut', 6,
      'width', 42
    ),
    'receipt_text', '              ##PENKEY DELICAF##
          5 New Street, Lymington
 WhatsApp Pre-orders: 01590 619472

========================================
1x Test Item                     5.00
1x Coffee                        3.50
1x Cake                          2.50
========================================

Subtotal:                       11.00
Tax (20%):                       2.20
========================================
**TOTAL:                         13.20**
========================================

Payment:                        Cash
' || to_char(now(), 'DD/MM/YYYY') || ' ' || to_char(now(), 'HH24:MI') || '
Order #12345

        Thank you for visiting'
  ),
  'pending',
  'normal',
  0,
  3,
  now(),
  now();
