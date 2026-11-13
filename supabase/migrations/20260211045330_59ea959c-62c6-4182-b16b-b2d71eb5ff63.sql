
-- 1. Bulk update all NO users to STARTER with 3-user limit
UPDATE saas_suite_users 
SET approval = 'STARTER', max_onboarding_users = 3
WHERE approval = 'NO';

-- 2. Grandfather dan@quantumcollective.com with unlimited users (NULL = unlimited)
UPDATE saas_suite_users 
SET max_onboarding_users = NULL
WHERE lower(email) = 'dan@quantumcollective.com';

-- 3. Turn off branded AI support for richard@maupalife.co.za
UPDATE saas_suite_users 
SET branded_ai_support = false
WHERE lower(email) = 'richard@maupalife.co.za';
