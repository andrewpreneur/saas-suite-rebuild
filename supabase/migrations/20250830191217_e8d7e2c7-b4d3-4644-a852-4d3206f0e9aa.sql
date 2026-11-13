-- Check current state of users without agency_id
SELECT COUNT(*) as users_without_agency_id 
FROM saas_suite_users 
WHERE agency_id IS NULL;

-- Generate agency_id for users who don't have one
UPDATE saas_suite_users 
SET agency_id = REPLACE(gen_random_uuid()::text, '-', '')
WHERE agency_id IS NULL;