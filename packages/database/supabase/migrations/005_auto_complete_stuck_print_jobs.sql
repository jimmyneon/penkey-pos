-- Auto-complete print jobs stuck in 'printing' status
-- Since we can't get feedback from the printer, we assume success after 2 minutes

-- Function to auto-complete stuck jobs
CREATE OR REPLACE FUNCTION auto_complete_stuck_print_jobs()
RETURNS void AS $$
BEGIN
  -- Update jobs stuck in 'printing' for more than 2 minutes
  UPDATE print_jobs
  SET 
    status = 'completed',
    printed_at = now(),
    updated_at = now()
  WHERE 
    status = 'printing'
    AND updated_at < now() - interval '2 minutes';
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to run this function periodically
-- Note: This requires pg_cron extension, or you can run this via a scheduled job
-- Alternative: Create a materialized view that refreshes periodically

-- For Supabase, use pg_cron if available:
-- SELECT cron.schedule(
--   'auto-complete-print-jobs',
--   '* * * * *',  -- Every minute
--   'SELECT auto_complete_stuck_print_jobs();'
-- );

-- Or run this manually via a scheduled job in your application
