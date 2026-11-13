-- Add plan column to saas_suite_users table
-- Create enum for plan types
CREATE TYPE public.plan_type AS ENUM ('BASIC', 'ADVANCED');

-- Add plan column with default value
ALTER TABLE public.saas_suite_users 
ADD COLUMN plan public.plan_type NOT NULL DEFAULT 'ADVANCED';

-- Set all existing users to ADVANCED plan
UPDATE public.saas_suite_users 
SET plan = 'ADVANCED' 
WHERE plan IS NULL OR plan = 'ADVANCED';

-- Add comment for documentation
COMMENT ON COLUMN public.saas_suite_users.plan IS 'User subscription plan type - BASIC or ADVANCED';