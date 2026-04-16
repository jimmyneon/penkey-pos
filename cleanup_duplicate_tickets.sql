-- Cleanup duplicate saved tickets
-- Keeps only the OLDEST ticket for each unique combination

WITH duplicates AS (
  SELECT 
    id,
    name,
    comment,
    org_id,
    total,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY org_id, name, comment, total, 
                   (lines::text), -- Include lines content in deduplication
                   COALESCE((ticket_assignment->>'name')::text, '')
      ORDER BY created_at ASC  -- Keep the oldest one
    ) as rn
  FROM saved_tickets
)
DELETE FROM saved_tickets
WHERE id IN (
  SELECT id 
  FROM duplicates 
  WHERE rn > 1  -- Delete all but the first (oldest) occurrence
);

-- Show what's left
SELECT 
  name,
  COUNT(*) as remaining_count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM saved_tickets
GROUP BY name, org_id
ORDER BY remaining_count DESC, name;
