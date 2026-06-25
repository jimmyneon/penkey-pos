-- Migration 032: Fix events_outbox cleanup + reduce printer_logs retention
--
-- Issues found after 1 day of monitoring:
-- 1. events_outbox: All 21,882 rows have status='pending' — they're never processed.
--    The cleanup function only deleted 'synced/processed/completed/failed' rows,
--    so 'pending' rows accumulated forever. Fix: delete ALL rows older than 3 days
--    regardless of status (if they haven't been delivered in 3 days, they're stale).
-- 2. printer_logs: 124,197 rows in 7 days = ~17,000/day = 60MB.
--    Reduce retention to 1 day — printer issues show up immediately, not days later.
-- 3. print_jobs: Working correctly (133 rows, 248KB). No change needed.

-- ============================================================
-- Fix 1: printer_logs retention → 1 day
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_old_printer_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM printer_logs
  WHERE timestamp < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Fix 2: events_outbox — delete ALL rows older than 3 days
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_old_events_outbox()
RETURNS void AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'events_outbox'
  ) THEN
    -- Delete ALL rows older than 3 days regardless of status.
    -- These are event outbox entries for webhooks/realtime that were never
    -- delivered. If they haven't been picked up in 3 days, they're stale.
    EXECUTE format(
      'DELETE FROM events_outbox WHERE created_at < %L',
      NOW() - INTERVAL '3 days'
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Immediate purge with new rules
-- ============================================================
SELECT cleanup_old_printer_logs();
SELECT cleanup_old_events_outbox();

-- ============================================================
-- Verify cron job for daily cleanup is still scheduled
-- ============================================================
-- SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'daily-db-cleanup';

-- ============================================================
-- Check daily cleanup execution history (filter for jobid 3)
-- ============================================================
-- SELECT runid, jobid, status, start_time, end_time, return_message
-- FROM cron.job_run_details 
-- WHERE jobid = 3
-- ORDER BY start_time DESC 
-- LIMIT 10;
