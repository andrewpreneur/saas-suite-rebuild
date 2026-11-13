-- Suspend Laura Hanson using the same pattern as suspend_user_access RPC
UPDATE saas_suite_users 
SET approval = 'NO',
    agency_id = agency_id || 'NO'
WHERE lower(email) = 'mrslaurahanson@gmail.com'
  AND approval != 'NO';

-- Delete her auth account
DELETE FROM auth.users 
WHERE lower(email) = 'mrslaurahanson@gmail.com';