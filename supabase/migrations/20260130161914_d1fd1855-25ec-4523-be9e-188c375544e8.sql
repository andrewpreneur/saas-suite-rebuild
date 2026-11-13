-- Drop the existing constraint and add a new one that includes BOTH
ALTER TABLE public.saas_suite_users 
DROP CONSTRAINT login_with_check;

ALTER TABLE public.saas_suite_users 
ADD CONSTRAINT login_with_check 
CHECK (login_with = ANY (ARRAY['EMAIL'::text, 'NAME'::text, 'BOTH'::text]));