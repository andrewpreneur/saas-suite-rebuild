-- Add login_with column to saas_suite_users table
ALTER TABLE public.saas_suite_users 
ADD COLUMN login_with text NOT NULL DEFAULT 'EMAIL';

-- Add check constraint to ensure valid values
ALTER TABLE public.saas_suite_users 
ADD CONSTRAINT login_with_check CHECK (login_with IN ('EMAIL', 'NAME'));