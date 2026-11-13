CREATE OR REPLACE FUNCTION public.get_advanced_agency_ids()
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ids text[];
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN ARRAY[]::text[];
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT x FROM (
      SELECT unnest(ARRAY[agency_id, agency_id_basic, agency_id_advanced, agency_id_elite]) AS x
      FROM public.saas_suite_users
      WHERE plan = 'ADVANCED'
    ) s
    WHERE x IS NOT NULL AND length(trim(x)) > 0
  ) INTO ids;

  RETURN COALESCE(ids, ARRAY[]::text[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_advanced_agency_ids() TO authenticated;