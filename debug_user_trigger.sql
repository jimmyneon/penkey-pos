-- Debug the user signup trigger
-- Run this to check if the trigger is working

-- 1. Check if the trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 2. Check if the function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'create_employee_on_user_signup';

-- 3. Check recent org_members entries
SELECT id, org_id, user_id, email, first_name, last_name, display_name, role_id, created_at
FROM org_members
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check recent employee_pins entries
SELECT id, member_id, created_at
FROM employee_pins
ORDER BY created_at DESC
LIMIT 10;

-- 5. Test the function manually (replace with a real user_id)
-- Uncomment and replace UUID with a real user_id from auth.users
-- SELECT create_employee_on_user_signup() -- This won't work directly

-- 6. Check if there are any recent auth.users
-- Note: You may not have access to auth.users directly
-- But you can check if org_members has entries for your new user
