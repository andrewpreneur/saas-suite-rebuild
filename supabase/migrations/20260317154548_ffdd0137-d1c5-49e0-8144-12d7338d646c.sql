-- Remove Michael's standalone account approval so AccountSelector only shows Wendy's account
-- This way he auto-selects into Wendy's dashboard as an admin
UPDATE saas_suite_users 
SET approval = NULL, agency_id = NULL, agency_name = NULL
WHERE lower(email) = 'michael@porchlightgrowth.com';