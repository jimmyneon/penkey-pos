-- ============================================
-- DATABASE SCHEMA CHECK
-- Run these queries in Supabase SQL Editor
-- Copy and paste the results back to me
-- ============================================

-- 1. Check what tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Check receipts table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'receipts'
ORDER BY ordinal_position;

-- 3. Check if receipt_templates table exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'receipt_templates'
ORDER BY ordinal_position;

-- 4. Check what org-related tables exist (orgs vs organizations)
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE '%org%' OR table_name LIKE '%organization%')
ORDER BY table_name;

-- 5. Check foreign keys on receipts table
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'receipts' 
  AND tc.constraint_type = 'FOREIGN KEY';

-- 6. Check indexes on receipts table
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'receipts'
ORDER BY indexname;
