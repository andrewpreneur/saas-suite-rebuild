-- Add affiliate_id column to track referrals
ALTER TABLE public.saas_suite_users 
ADD COLUMN affiliate_id text;