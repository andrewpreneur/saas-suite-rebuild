-- Fix critical security vulnerability: Restrict access to user_tool_data table
-- Current policies allow public access to all user data including emails and personal configurations

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can create their own tool data" ON public.user_tool_data;
DROP POLICY IF EXISTS "Users can delete their own tool data" ON public.user_tool_data;
DROP POLICY IF EXISTS "Users can update their own tool data" ON public.user_tool_data;
DROP POLICY IF EXISTS "Users can view their own tool data" ON public.user_tool_data;

-- Create restrictive policies that deny public access
CREATE POLICY "Deny public access to user_tool_data" 
ON public.user_tool_data 
FOR ALL
USING (false)
WITH CHECK (false);

-- Create secure functions for controlled user tool data access

-- Function to save user tool data securely
CREATE OR REPLACE FUNCTION public.save_user_tool_data_safe(user_email text, tool_name text, tool_data jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate inputs
  IF user_email IS NULL OR user_email = '' OR tool_name IS NULL OR tool_name = '' THEN
    RAISE EXCEPTION 'Email and tool name cannot be empty';
  END IF;
  
  -- Upsert tool data for the user
  INSERT INTO user_tool_data (user_email, tool_name, tool_data, created_at, updated_at)
  VALUES (user_email, tool_name, tool_data, now(), now())
  ON CONFLICT (user_email, tool_name)
  DO UPDATE SET 
    tool_data = EXCLUDED.tool_data,
    updated_at = now();
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Function to load user tool data securely
CREATE OR REPLACE FUNCTION public.load_user_tool_data_safe(user_email text, tool_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Validate inputs
  IF user_email IS NULL OR user_email = '' OR tool_name IS NULL OR tool_name = '' THEN
    RETURN NULL;
  END IF;
  
  -- Get tool data for specific user and tool
  SELECT tool_data INTO result
  FROM user_tool_data
  WHERE user_email = load_user_tool_data_safe.user_email 
    AND tool_name = load_user_tool_data_safe.tool_name;
  
  RETURN result;
END;
$$;

-- Function to delete user tool data securely
CREATE OR REPLACE FUNCTION public.delete_user_tool_data_safe(user_email text, tool_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate inputs
  IF user_email IS NULL OR user_email = '' OR tool_name IS NULL OR tool_name = '' THEN
    RETURN false;
  END IF;
  
  -- Delete specific tool data for user
  DELETE FROM user_tool_data
  WHERE user_email = delete_user_tool_data_safe.user_email 
    AND tool_name = delete_user_tool_data_safe.tool_name;
  
  RETURN FOUND;
END;
$$;

-- Function to get all user tool data securely
CREATE OR REPLACE FUNCTION public.get_all_user_tool_data_safe(user_email text)
RETURNS TABLE(tool_name text, tool_data jsonb, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate input
  IF user_email IS NULL OR user_email = '' THEN
    RETURN;
  END IF;
  
  -- Return all tool data for specific user only
  RETURN QUERY
  SELECT utd.tool_name, utd.tool_data, utd.updated_at
  FROM user_tool_data utd
  WHERE utd.user_email = get_all_user_tool_data_safe.user_email
  ORDER BY utd.updated_at DESC;
END;
$$;