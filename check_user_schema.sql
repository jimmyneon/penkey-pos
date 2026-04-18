-- ============================================
-- CHECK USER/EMPLOYEE SCHEMA
-- Run this in Supabase SQL Editor to check the current schema
-- ============================================

-- 1. Check what tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Check org_members table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'org_members'
ORDER BY ordinal_position;

-- 3. Check employee_pins table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'employee_pins'
ORDER BY ordinal_position;

-- 4. Check roles table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'roles'
ORDER BY ordinal_position;

-- 5. Check orgs table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'orgs'
ORDER BY ordinal_position;

-- 6. Check existing orgs
SELECT id, name FROM orgs;

-- 7. Check existing roles
SELECT id, name FROM roles;

-- 8. Check existing org_members
SELECT id, org_id, user_id, first_name, last_name, display_name, role_id 
FROM org_members 
LIMIT 5;

-- 9. Check existing employee_pins
SELECT org_member_id, pin_hash FROM employee_pins LIMIT 5;

-- 10. Check if verify_pin function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%pin%';
