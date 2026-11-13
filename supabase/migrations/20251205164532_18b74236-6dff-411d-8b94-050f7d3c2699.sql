-- Add branded_ai_support column to track if user has upgraded to branded agent
ALTER TABLE public.saas_suite_users 
ADD COLUMN IF NOT EXISTS branded_ai_support boolean NOT NULL DEFAULT false;

-- Add ai_embed_code column to store custom embed code for branded users
ALTER TABLE public.saas_suite_users 
ADD COLUMN IF NOT EXISTS ai_embed_code text;