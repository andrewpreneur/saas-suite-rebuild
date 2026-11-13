UPDATE saas_suite_users
SET agency_id_basic = agency_id
WHERE agency_id IS NOT NULL
  AND agency_id_basic IS NULL;