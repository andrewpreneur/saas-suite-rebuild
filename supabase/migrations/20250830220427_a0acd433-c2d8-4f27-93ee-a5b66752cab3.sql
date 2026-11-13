-- Update RLS policies for saas_suite_users to allow authenticated users to update their own records
DROP POLICY IF EXISTS "Deny public access to saas_suite_users" ON public.saas_suite_users;

-- Allow users to read their own record
CREATE POLICY "Users can view their own saas_suite_users record" 
ON public.saas_suite_users 
FOR SELECT 
USING (
  email = (SELECT email FROM auth.users WHERE auth.uid() = auth.users.id)
);

-- Allow users to update their own record  
CREATE POLICY "Users can update their own saas_suite_users record" 
ON public.saas_suite_users 
FOR UPDATE 
USING (
  email = (SELECT email FROM auth.users WHERE auth.uid() = auth.users.id)
);

-- Allow users to insert their own record (for registration)
CREATE POLICY "Users can insert their own saas_suite_users record" 
ON public.saas_suite_users 
FOR INSERT 
WITH CHECK (
  email = (SELECT email FROM auth.users WHERE auth.uid() = auth.users.id)
);