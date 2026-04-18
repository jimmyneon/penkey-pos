-- Add employee records for a new user
-- Run this after creating a user in Supabase Auth
-- Replace the email and names below with the actual user details

-- 1. Set the user email, first name, and last name
\set user_email 'newuser@example.com'
\set first_name 'New'
\set last_name 'User'

-- 2. Single query that creates both org_members and employee_pins entries
WITH new_member AS (
  INSERT INTO org_members (
    id,
    org_id,
    user_id,
    email,
    first_name,
    last_name,
    display_name,
    role_id,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000001'::UUID,  -- Penkey org
    (SELECT id FROM auth.users WHERE email = :'user_email'),
    :'user_email',
    :'first_name',
    :'last_name',
    :'first_name' || ' ' || :'last_name',
    '00000000-0000-0000-0000-000000000012'::UUID,  -- Cashier role
    true,
    NOW(),
    NOW()
  ) RETURNING id
)
INSERT INTO employee_pins (
  id,
  member_id,
  pin_hash,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  id,
  crypt('0000', gen_salt('bf')),  -- Default PIN: 0000
  NOW(),
  NOW()
FROM new_member;

-- 3. Verify the entry was created
SELECT 
  om.id,
  om.email,
  om.first_name,
  om.last_name,
  om.role_id,
  r.name as role_name
FROM org_members om
LEFT JOIN roles r ON om.role_id = r.id
WHERE om.email = :'user_email';
