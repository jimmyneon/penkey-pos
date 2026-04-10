-- Run this in Supabase SQL Editor to check the receipts table schema
-- This will show us what columns actually exist

-- Check if receipts table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'receipts';

-- Get all columns in receipts table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'receipts'
ORDER BY ordinal_position;

-- Check for idempotency_key column specifically
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'receipts'
AND column_name = 'idempotency_key';

-- Check for payment_provider column
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'receipts'
AND column_name = 'payment_provider';

-- Check receipt_lines table columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'receipt_lines'
ORDER BY ordinal_position;

-- Check payments table columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'payments'
ORDER BY ordinal_position;
