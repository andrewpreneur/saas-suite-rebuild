
-- Delete the duplicate account first to free up the email
DELETE FROM saas_suite_users WHERE id = 400;

-- Now merge Jon's customizations into the remaining account
UPDATE saas_suite_users 
SET 
  email = 'propelprofitsmarketing@gmail.com',
  full_name = 'Jon',
  agency_name = 'propelprofits',
  agency_id = 'propelprofits',
  agency_id_basic = 'propelprofitsNO',
  agency_id_elite = 'propelprofits-3NO',
  primary_color = '#052fff',
  secondary_color = '#000000',
  tertiary_color = '#000000',
  login_with = 'NAME',
  plan = 'ADVANCED'
WHERE id = 401;
