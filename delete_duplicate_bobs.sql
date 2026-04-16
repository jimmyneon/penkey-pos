-- ONLY RUN THIS IF Bob's tickets are actual duplicates (same items/total)
-- This will keep only the OLDEST Bob ticket and delete the rest

-- First, check what we're about to delete:
SELECT 
  id,
  name,
  total,
  created_at,
  'WILL BE DELETED' as status
FROM saved_tickets
WHERE name = 'Bob'
  AND id NOT IN (
    SELECT id 
    FROM saved_tickets 
    WHERE name = 'Bob' 
    ORDER BY created_at ASC 
    LIMIT 1
  )
ORDER BY created_at;

-- If the above looks correct, uncomment and run this:
/*
DELETE FROM saved_tickets
WHERE name = 'Bob'
  AND id NOT IN (
    SELECT id 
    FROM saved_tickets 
    WHERE name = 'Bob' 
    ORDER BY created_at ASC 
    LIMIT 1
  );
*/

-- Same for Dave (keeps oldest, deletes rest):
/*
DELETE FROM saved_tickets
WHERE name = 'Dave'
  AND id NOT IN (
    SELECT id 
    FROM saved_tickets 
    WHERE name = 'Dave' 
    ORDER BY created_at ASC 
    LIMIT 1
  );
*/

-- Verify after deletion:
SELECT name, COUNT(*) as count
FROM saved_tickets
GROUP BY name
ORDER BY count DESC, name;
