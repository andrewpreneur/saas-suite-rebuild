-- Move testing1@gmail.com to day 8 of trial (7 days remaining)
UPDATE saas_suite_users 
SET trial_start_date = now() - interval '8 days'
WHERE email = 'testing1@gmail.com' AND approval = 'TRIALING';