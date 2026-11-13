-- Fix critical security vulnerability: Restrict access to user_progress table
-- Current policies allow public access to all email addresses

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Allow email-based insert" ON public.user_progress;
DROP POLICY IF EXISTS "Allow email-based select" ON public.user_progress;
DROP POLICY IF EXISTS "Allow email-based update" ON public.user_progress;

-- Since this system uses email-based authentication without Supabase Auth,
-- we need to implement a more secure approach.
-- For now, we'll restrict all direct access to the table and require
-- application-level access control through service role calls.

-- Create restrictive policies that deny public access
CREATE POLICY "Deny public access to user_progress" 
ON public.user_progress 
FOR ALL
USING (false)
WITH CHECK (false);

-- Create a security definer function for controlled access
-- This function will be used by the application to safely access user data
CREATE OR REPLACE FUNCTION public.get_user_progress_by_email(user_email text)
RETURNS TABLE(id uuid, created_at timestamptz, email text)
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
  SELECT up.id, up.created_at, up.email
  FROM user_progress up
  WHERE up.email = user_email;
END;
$$;

-- Create a function for safe user progress creation
CREATE OR REPLACE FUNCTION public.create_user_progress_safe(user_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id uuid;
BEGIN
  -- Validate email
  IF user_email IS NULL OR user_email = '' THEN
    RAISE EXCEPTION 'Email cannot be empty';
  END IF;
  
  -- Check if user already exists
  SELECT id INTO user_id FROM user_progress WHERE email = user_email;
  
  IF user_id IS NULL THEN
    -- Create new user progress record
    INSERT INTO user_progress (email) VALUES (user_email) RETURNING id INTO user_id;
  END IF;
  
  RETURN user_id;
END;
$$;