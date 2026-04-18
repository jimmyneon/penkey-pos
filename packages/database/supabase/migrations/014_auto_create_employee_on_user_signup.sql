-- Auto-create employee records when a new user signs up
-- This trigger runs when a new user is created in auth.users
-- It automatically creates:
-- 1. org_members entry (links user to organization)
-- 2. employee_pins entry (sets default PIN to 0000)

-- First, create the hash_pin function if it doesn't exist
CREATE OR REPLACE FUNCTION hash_pin(p_pin TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Use crypt with bcrypt to hash the PIN
  -- Format: bcrypt(cost, salt, hash)
  RETURN crypt(p_pin, gen_salt('bf'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the verify_pin function if it doesn't exist
CREATE OR REPLACE FUNCTION verify_pin(p_pin TEXT, p_hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (p_hash = crypt(p_pin, p_hash));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create employee records on user signup
CREATE OR REPLACE FUNCTION create_employee_on_user_signup()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_member_id UUID;
  default_pin TEXT := '0000';
BEGIN
  -- Create the org_members entry
  -- Using hardcoded org_id and role_id from your schema
  -- Org: Penkey (00000000-0000-0000-0000-000000000001)
  -- Default role: Cashier (00000000-0000-0000-0000-000000000012)
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
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'New'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    '00000000-0000-0000-0000-000000000012'::UUID,
    true,
    NOW(),
    NOW()
  ) RETURNING id INTO new_member_id;
  
  -- Create the employee_pins entry with default PIN "0000"
  INSERT INTO employee_pins (
    id,
    member_id,
    pin_hash,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_member_id,
    hash_pin(default_pin),
    NOW(),
    NOW()
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE LOG 'Error creating employee records for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Create the function in public schema
CREATE OR REPLACE FUNCTION public.create_employee_on_user_signup()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  new_member_id UUID;
  default_pin TEXT := '0000';
BEGIN
  -- Create the org_members entry
  -- Using hardcoded org_id and role_id from your schema
  -- Org: Penkey (00000000-0000-0000-0000-000000000001)
  -- Default role: Cashier (00000000-0000-0000-0000-000000000012)
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
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'New'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    '00000000-0000-0000-0000-000000000012'::UUID,
    true,
    NOW(),
    NOW()
  ) RETURNING id INTO new_member_id;
  
  -- Create the employee_pins entry with default PIN "0000"
  INSERT INTO employee_pins (
    id,
    member_id,
    pin_hash,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_member_id,
    hash_pin(default_pin),
    NOW(),
    NOW()
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE LOG 'Error creating employee records for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Drop any existing triggers (cleanup)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger on auth.users
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_employee_on_user_signup();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.hash_pin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_pin(TEXT, TEXT) TO authenticated;

-- Grant supabase_auth_admin permissions to insert into public tables
-- This is required for the trigger to work when users are created in auth
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT INSERT, SELECT ON TABLE public.org_members TO supabase_auth_admin;
GRANT INSERT, SELECT ON TABLE public.employee_pins TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.hash_pin(TEXT) TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.uuid_generate_v4() TO supabase_auth_admin;
