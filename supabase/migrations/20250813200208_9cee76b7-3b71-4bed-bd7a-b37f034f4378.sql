-- Fix critical security vulnerability: Restrict access to saas_suite_users table
-- Current policies allow public access to all email addresses

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Allow email lookup" ON public.saas_suite_users;
DROP POLICY IF EXISTS "Allow last_accessed updates" ON public.saas_suite_users;
DROP POLICY IF EXISTS "Allow public signup" ON public.saas_suite_users;

-- Create restrictive policies that deny public access
CREATE POLICY "Deny public access to saas_suite_users" 
ON public.saas_suite_users 
FOR ALL
USING (false)
WITH CHECK (false);

-- Create a security definer function for controlled user registration
CREATE OR REPLACE FUNCTION public.register_user_safe(user_email text, user_approval text DEFAULT 'PENDING')
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id bigint;
BEGIN
  -- Validate email
  IF user_email IS NULL OR user_email = '' THEN
    RAISE EXCEPTION 'Email cannot be empty';
  END IF;
  
  -- Check if user already exists
  SELECT id INTO user_id FROM saas_suite_users WHERE email = user_email;
  
  IF user_id IS NULL THEN
    -- Create new user record
    INSERT INTO saas_suite_users (email, approval) 
    VALUES (user_email, user_approval) 
    RETURNING id INTO user_id;
  END IF;
  
  RETURN user_id;
END;
$$;

-- Create a function for safe user lookup by email
CREATE OR REPLACE FUNCTION public.get_user_by_email(user_email text)
RETURNS TABLE(id bigint, created_at timestamptz, email text, approval text, last_accessed timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add basic validation
  IF user_email IS NULL OR user_email = '' THEN
    RETURN;
  END IF;
  
  -- Return only the specific user's data
  RETURN QUERY
  SELECT u.id, u.created_at, u.email, u.approval, u.last_accessed
  FROM saas_suite_users u
  WHERE u.email = user_email;
END;
$$;

-- Create a function for safe user updates
CREATE OR REPLACE FUNCTION public.update_user_access(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate email
  IF user_email IS NULL OR user_email = '' THEN
    RETURN false;
  END IF;
  
  -- Update last accessed time
  UPDATE saas_suite_users 
  SET last_accessed = now() 
  WHERE email = user_email;
  
  RETURN FOUND;
END;
$$;