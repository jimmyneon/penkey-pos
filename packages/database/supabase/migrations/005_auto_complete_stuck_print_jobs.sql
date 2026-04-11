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

-- Schedule the function to run every minute using pg_cron
SELECT cron.schedule(
  'auto-complete-print-jobs',
  '* * * * *',  -- Every minute
  'SELECT auto_complete_stuck_print_jobs();'
);
