CREATE OR REPLACE FUNCTION public.get_advanced_agency_ids()
RETURNS text[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ids text[];
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN ARRAY[]::text[];
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT x
    FROM public.saas_suite_users ssu
    CROSS JOIN LATERAL unnest(ARRAY[
      ssu.agency_id,
      ssu.agency_id_basic,
      ssu.agency_id_advanced,
      ssu.agency_id_elite,
      ssu.original_agency_id,
      ssu.original_agency_id_basic,
      ssu.original_agency_id_advanced,
      ssu.original_agency_id_elite,
      ssu.agency_name
    ]) AS u(x)
    WHERE ssu.approval IS DISTINCT FROM 'NO'
      AND x IS NOT NULL
      AND length(trim(x)) > 0
  ) INTO ids;

  RETURN COALESCE(ids, ARRAY[]::text[]);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_advanced_agency_ids() TO authenticated;