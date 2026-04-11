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

-- Use a trigger that checks on every update
-- This will auto-complete jobs when any other job is updated
CREATE OR REPLACE FUNCTION check_and_complete_stuck_jobs()
RETURNS trigger AS $$
BEGIN
  -- Check for stuck jobs whenever print_jobs table is updated
  PERFORM auto_complete_stuck_print_jobs();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-complete stuck jobs on any print_jobs update
DROP TRIGGER IF EXISTS auto_complete_stuck_jobs_trigger ON print_jobs;
CREATE TRIGGER auto_complete_stuck_jobs_trigger
AFTER UPDATE ON print_jobs
FOR EACH ROW
EXECUTE FUNCTION check_and_complete_stuck_jobs();
