-- ============================================================================
-- DELETE ALL TEST TRANSACTIONS
-- ============================================================================
-- This script removes all test/demo data from the POS system
-- Use this to clean up before going live with production data
--
-- WARNING: This action is IRREVERSIBLE. Make sure you have a backup if needed.
-- ============================================================================

BEGIN;

-- Step 1: Delete all receipt items (line items from receipts)
DELETE FROM receipt_items;

-- Step 2: Delete all receipts (transactions)
DELETE FROM receipts;

-- Step 3: Delete all refunds (if any)
DELETE FROM refunds WHERE TRUE;

-- Step 4: Delete all print jobs related to receipts
DELETE FROM print_jobs WHERE receipt_id IS NOT NULL;

-- Step 5: Delete any orphaned print jobs (optional - keeps non-receipt print jobs)
-- Uncomment the line below if you want to delete ALL print jobs
-- DELETE FROM print_jobs;

-- Step 6: Delete all active carts (saved tickets)
DELETE FROM active_carts;

-- Step 7: Reset any shift data (if you want to clear shift history)
-- Uncomment the lines below if you want to delete shift data as well
-- DELETE FROM shift_receipts;
-- DELETE FROM shifts;

-- Step 8: Clear any cached analytics or summary data (if such tables exist)
-- Add any additional cleanup queries here for custom tables

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after the delete to verify everything was cleaned up:

-- Check receipt counts (should be 0)
SELECT COUNT(*) as receipt_count FROM receipts;

-- Check receipt items counts (should be 0)
SELECT COUNT(*) as receipt_items_count FROM receipt_items;

-- Check refunds counts (should be 0)
SELECT COUNT(*) as refunds_count FROM refunds;

-- Check print jobs counts (should show only non-receipt jobs if any)
SELECT COUNT(*) as print_jobs_count FROM print_jobs;

-- Check active carts counts (should be 0)
SELECT COUNT(*) as active_carts_count FROM active_carts;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. This script does NOT delete:
--    - Items, categories, modifiers (your product catalog)
--    - Employees, users, roles
--    - Organization settings
--    - Printer configurations
--    - Register/terminal settings
--
-- 2. After running this script, you may want to:
--    - Clear IndexedDB in the browser (Application > Storage > Clear site data)
--    - Log out and log back in to refresh the session
--    - Verify the POS displays correctly with no transactions
--
-- 3. To run this script:
--    - Via Supabase Dashboard: SQL Editor > New Query > Paste & Run
--    - Via psql: psql -h <host> -U <user> -d <database> -f delete_test_transactions.sql
--    - Via code: Execute as a raw SQL query through Supabase client
-- ============================================================================
