-- Clear all pending print jobs for testing
-- This will delete all jobs with status 'pending'

DELETE FROM print_jobs 
WHERE status = 'pending';

-- Or to only clear jobs for a specific printer:
-- DELETE FROM print_jobs 
-- WHERE status = 'pending' AND printer_id = '00000000-0000-0000-0000-0000000000a0';

-- To check how many pending jobs exist before clearing:
-- SELECT COUNT(*) FROM print_jobs WHERE status = 'pending';
