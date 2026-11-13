DROP FUNCTION IF EXISTS public.get_user_agency_versions(text);

CREATE FUNCTION public.get_user_agency_versions(user_email text)
RETURNS TABLE (
  base_id text,
  basic_id text,
  advanced_id text,
  elite_id text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF user_email IS NULL OR user_email = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    u.agency_id,
    u.agency_id_basic,
    u.agency_id_advanced,
    u.agency_id_elite
  FROM public.saas_suite_users u
  WHERE lower(trim(u.email)) = lower(trim(user_email));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_agency_versions(text) TO authenticated, anon, service_role;