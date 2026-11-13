UPDATE saas_suite_users
SET agency_id = CASE WHEN agency_id LIKE '%NO' THEN regexp_replace(agency_id, '-?NO$', '') ELSE agency_id END,
    agency_id_basic = CASE WHEN agency_id_basic LIKE '%NO' THEN regexp_replace(agency_id_basic, '-?NO$', '') ELSE agency_id_basic END,
    agency_id_advanced = CASE WHEN agency_id_advanced LIKE '%NO' THEN regexp_replace(agency_id_advanced, '-?NO$', '') ELSE agency_id_advanced END,
    agency_id_elite = CASE WHEN agency_id_elite LIKE '%NO' THEN regexp_replace(agency_id_elite, '-?NO$', '') ELSE agency_id_elite END
WHERE lower(email) = 'mal.herring@smallstepbigstep.com';