-- Migration 031: Setup pg_cron for automated cleanup of growing tables
-- 
-- Problem: printer_logs was 306MB (61% of 500MB free tier limit), events_outbox 24MB,
-- print_jobs growing indefinitely. No automated cleanup was running.
--
-- This migration:
-- 1. Enables pg_cron extension
-- 2. Creates cleanup functions for printer_logs, print_jobs, and events_outbox
-- 3. Schedules daily cleanup at 3 AM UTC
-- 4. Runs immediate purge of old data
--
-- IMPORTANT: Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- pg_cron cannot be enabled via REST API — must be run directly in SQL Editor.

-- ============================================================
-- Step 1: Enable pg_cron extension
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Grant usage to postgres role (required for pg_cron)
GRANT USAGE ON SCHEMA cron TO postgres;

-- ============================================================
-- Step 2: Cleanup function for printer_logs (keep 7 days)
-- ============================================================
-- The function cleanup_old_printer_logs() already exists from the original
-- migration (migrations/create_printer_logs_table.sql) but was never scheduled.
-- Recreate it here with a shorter retention period (7 days instead of 30).

CREATE OR REPLACE FUNCTION cleanup_old_printer_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM printer_logs
  WHERE timestamp < NOW() - INTERVAL '7 days';
  
  -- Also vacuum the table to reclaim disk space
  -- (VACUUM cannot run inside a function, but autovacuum will handle it)
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Step 3: Cleanup function for print_jobs (keep 7 days)
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_old_print_jobs()
RETURNS void AS $$
BEGIN
  DELETE FROM print_jobs
  WHERE status IN ('completed', 'failed', 'cancelled')
    AND created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Step 4: Cleanup function for events_outbox (keep 7 days)
-- ============================================================
-- events_outbox table was created outside of migrations, so we check
-- if it exists before creating the function.

CREATE OR REPLACE FUNCTION cleanup_old_events_outbox()
RETURNS void AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'events_outbox'
  ) THEN
    -- Delete synced/processed events older than 7 days
    -- Try common status column values
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'events_outbox' AND column_name = 'status'
    ) THEN
      EXECUTE format(
        'DELETE FROM events_outbox WHERE status IN (''synced'', ''processed'', ''completed'', ''failed'') AND created_at < %L',
        NOW() - INTERVAL '7 days'
      );
    ELSE
      -- No status column — just delete by age
      EXECUTE format(
        'DELETE FROM events_outbox WHERE created_at < %L',
        NOW() - INTERVAL '7 days'
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Step 5: Combined cleanup function (runs all three)
-- ============================================================
CREATE OR REPLACE FUNCTION run_daily_cleanup()
RETURNS void AS $$
BEGIN
  PERFORM cleanup_old_printer_logs();
  PERFORM cleanup_old_print_jobs();
  PERFORM cleanup_old_events_outbox();
  
  -- Log that cleanup ran (to a simple table for debugging)
  RAISE NOTICE 'Daily cleanup completed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Step 6: Schedule daily cleanup at 3 AM UTC
-- ============================================================
-- Unschedule any existing jobs with the same name first (idempotent)
DO $$
BEGIN
  -- Check if job exists and unschedule if so
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-db-cleanup') THEN
    PERFORM cron.unschedule('daily-db-cleanup');
  END IF;
END $$;

-- Schedule the combined cleanup
SELECT cron.schedule(
  'daily-db-cleanup',           -- job name
  '0 3 * * *',                  -- 3 AM UTC every day
  'SELECT run_daily_cleanup()'  -- what to run
);

-- ============================================================
-- Step 7: Immediate purge — reclaim disk space NOW
-- ============================================================
-- Run the cleanup immediately to purge old data right away
-- instead of waiting for the first scheduled run at 3 AM.

SELECT cleanup_old_printer_logs();
SELECT cleanup_old_print_jobs();
SELECT cleanup_old_events_outbox();

-- ============================================================
-- Step 8: VACUUM FULL to reclaim disk space from the purge
-- ============================================================
-- VACUUM FULL rewrites the table and reclaims space to the OS.
-- This is important after a large DELETE to actually reduce
-- the database size (regular VACUUM only marks space as reusable).
-- 
-- NOTE: VACUUM FULL cannot run inside a transaction or function.
-- Run these manually in the SQL Editor AFTER running this migration:
--
-- VACUUM FULL printer_logs;
-- VACUUM FULL print_jobs;
-- VACUUM FULL events_outbox;
--
-- Or just run: VACUUM FULL;

-- ============================================================
-- Verification queries (run after migration to confirm)
-- ============================================================
-- Check scheduled jobs:
-- SELECT jobid, jobname, schedule, command, active FROM cron.job;
--
-- Check table sizes after cleanup:
-- SELECT 
--   schemaname || '.' || tablename as table_name,
--   pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as total_size
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
-- LIMIT 10;
