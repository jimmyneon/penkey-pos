-- Add employee records for a new user
-- Run this after creating a user in Supabase Auth
-- Replace the USER_ID below with the actual user ID from auth.users

-- 1. First, get the user ID from auth.users (if you have access)
-- SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;

-- 2. Set the user ID here
-- Replace with the actual user UUID from Supabase Auth
\set user_id 'YOUR_USER_ID_HERE'

-- 3. Create the org_members entry
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
  :'user_id',
  (SELECT email FROM auth.users WHERE id = :'user_id'),
  'New',  -- Replace with actual first name
  'User',  -- Replace with actual last name
  (SELECT email FROM auth.users WHERE id = :'user_id'),
  '00000000-0000-0000-0000-000000000012'::UUID,  -- Cashier role
  true,
  NOW(),
  NOW()
) RETURNING id;

-- 4. Get the member_id from the insert above and create the PIN entry
-- You'll need to copy the returned ID and use it in the next query
-- Replace MEMBER_ID_HERE with the actual ID returned from above

INSERT INTO employee_pins (
  id,
  member_id,
  pin_hash,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'MEMBER_ID_HERE'::UUID,  -- Replace with the ID returned from the INSERT above
  crypt('0000', gen_salt('bf')),  -- Default PIN: 0000
  NOW(),
  NOW()
);

-- Alternative: Single query that does both (if you know the email)
-- Uncomment and use this instead if you know the email address

/*
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
    '00000000-0000-0000-0000-000000000001'::UUID,
    (SELECT id FROM auth.users WHERE email = 'user@example.com'),
    'user@example.com',
    'First',
    'Last',
    'First Last',
    '00000000-0000-0000-0000-000000000012'::UUID,
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
  crypt('0000', gen_salt('bf')),
  NOW(),
  NOW()
FROM new_member;
*/
