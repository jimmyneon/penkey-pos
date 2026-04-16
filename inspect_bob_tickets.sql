-- Inspect Bob's 5 tickets to see if they're actually different
SELECT 
  id,
  name,
  comment,
  total,
  created_at,
  updated_at,
  jsonb_array_length(lines) as item_count,
  ticket_assignment->>'name' as assigned_to,
  ticket_assignment->>'type' as assignment_type
FROM saved_tickets
WHERE name = 'Bob'
ORDER BY created_at ASC;

-- Also check Dave's 2 tickets
SELECT 
  id,
  name,
  comment,
  total,
  created_at,
  updated_at,
  jsonb_array_length(lines) as item_count,
  ticket_assignment->>'name' as assigned_to,
  ticket_assignment->>'type' as assignment_type
FROM saved_tickets
WHERE name = 'Dave'
ORDER BY created_at ASC;
