
-- Enable RLS on saas_suite_users table (if not already enabled)
ALTER TABLE public.saas_suite_users ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert new users (since this is a public signup)
CREATE POLICY "Allow public signup" 
  ON public.saas_suite_users 
  FOR INSERT 
  WITH CHECK (true);

-- Create policy to allow anyone to select users by email (for login check)
CREATE POLICY "Allow email lookup" 
  ON public.saas_suite_users 
  FOR SELECT 
  USING (true);

-- Create policy to allow updating last_accessed for existing users
CREATE POLICY "Allow last_accessed updates" 
  ON public.saas_suite_users 
  FOR UPDATE 
  USING (true) 
  WITH CHECK (true);
