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
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_role_id UUID;
  v_member_id UUID;
  v_default_pin TEXT := '0000';
BEGIN
  -- Get the default organization (you can customize this logic)
  -- Option 1: Use the first org in the orgs table
  SELECT id INTO v_org_id FROM orgs LIMIT 1;
  
  -- Option 2: If you have a specific org_id, uncomment and set it:
  -- v_org_id := '00000000-0000-0000-0000-000000000001'::UUID;
  
  -- Get the default role (you can customize this logic)
  -- Option 1: Use a role named 'Cashier' or create a default
  SELECT id INTO v_role_id FROM roles WHERE name = 'Cashier' AND org_id = v_org_id LIMIT 1;
  
  -- If no default role found, try 'Manager' or first available role
  IF v_role_id IS NULL THEN
    SELECT id INTO v_role_id FROM roles WHERE name = 'Manager' AND org_id = v_org_id LIMIT 1;
  END IF;
  
  -- If still no role, use the first role in the table
  IF v_role_id IS NULL THEN
    SELECT id INTO v_role_id FROM roles WHERE org_id = v_org_id LIMIT 1;
  END IF;
  
  -- Option 2: If you have a specific role_id, uncomment and set it:
  -- v_role_id := '00000000-0000-0000-0000-000000000012'::UUID;
  
  -- Create the org_members entry
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
    v_org_id,
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'New'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    v_role_id,
    true,
    NOW(),
    NOW()
  ) RETURNING id INTO v_member_id;
  
  -- Create the employee_pins entry with default PIN "0000"
  INSERT INTO employee_pins (
    id,
    member_id,
    pin_hash,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_member_id,
    hash_pin(v_default_pin),
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
$$ LANGUAGE plpgsql;

-- Create the trigger on auth.users
-- Note: This requires the supabase_auth schema to be accessible
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION create_employee_on_user_signup();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION hash_pin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_pin(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_employee_on_user_signup() TO authenticated;
