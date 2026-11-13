-- Fix RLS policies for saas_suite_users with simpler logic
DROP POLICY IF EXISTS "Users can view their own saas_suite_users record" ON public.saas_suite_users;
DROP POLICY IF EXISTS "Users can update their own saas_suite_users record" ON public.saas_suite_users;
DROP POLICY IF EXISTS "Users can insert their own saas_suite_users record" ON public.saas_suite_users;

-- Allow users to read their own record
CREATE POLICY "Users can view their own saas_suite_users record" 
ON public.saas_suite_users 
FOR SELECT 
USING (
  email = auth.jwt() ->> 'email'
);

-- Allow users to update their own record  
CREATE POLICY "Users can update their own saas_suite_users record" 
ON public.saas_suite_users 
FOR UPDATE 
USING (
  email = auth.jwt() ->> 'email'
);

-- Allow users to insert their own record (for registration)
CREATE POLICY "Users can insert their own saas_suite_users record" 
ON public.saas_suite_users 
FOR INSERT 
WITH CHECK (
  email = auth.jwt() ->> 'email'
);