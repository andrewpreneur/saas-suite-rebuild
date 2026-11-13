CREATE OR REPLACE FUNCTION public.get_agency_user_limit(p_agency_id text)
RETURNS TABLE(max_users integer, current_users bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ssu.max_onboarding_users AS max_users,
    (SELECT COUNT(*) FROM (
      SELECT DISTINCT COALESCE(NULLIF(up.email, ''), up.name) AS user_key
      FROM user_progress up 
      WHERE up.agency_id = p_agency_id
        AND (
          (up.email IS NOT NULL AND up.email != '')
          OR (up.name IS NOT NULL AND up.name != '' AND up.name NOT LIKE 'Guest User #%')
        )
    ) unique_users) AS current_users
  FROM saas_suite_users ssu
  WHERE ssu.agency_id = p_agency_id
     OR ssu.agency_id_basic = p_agency_id
     OR ssu.agency_id_advanced = p_agency_id
     OR ssu.agency_id_elite = p_agency_id
  LIMIT 1;
END;
$$;