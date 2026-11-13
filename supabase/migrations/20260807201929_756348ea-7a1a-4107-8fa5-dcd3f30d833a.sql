CREATE OR REPLACE FUNCTION public.save_user_attribution(
  user_email text,
  p_fbclid text DEFAULT NULL,
  p_gclid text DEFAULT NULL,
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL,
  p_utm_term text DEFAULT NULL,
  p_utm_content text DEFAULT NULL,
  p_utm_id text DEFAULT NULL,
  p_referrer text DEFAULT NULL,
  p_landing_page text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  normalized_email text := lower(trim(user_email));
BEGIN
  IF normalized_email IS NULL OR normalized_email = '' THEN
    RETURN FALSE;
  END IF;

  UPDATE saas_suite_users
  SET
    fbclid       = COALESCE(NULLIF(fbclid, ''), NULLIF(trim(coalesce(p_fbclid, '')), '')),
    gclid        = COALESCE(NULLIF(gclid, ''), NULLIF(trim(coalesce(p_gclid, '')), '')),
    utm_source   = COALESCE(NULLIF(utm_source, ''), NULLIF(trim(coalesce(p_utm_source, '')), '')),
    utm_medium   = COALESCE(NULLIF(utm_medium, ''), NULLIF(trim(coalesce(p_utm_medium, '')), '')),
    utm_campaign = COALESCE(NULLIF(utm_campaign, ''), NULLIF(trim(coalesce(p_utm_campaign, '')), '')),
    utm_term     = COALESCE(NULLIF(utm_term, ''), NULLIF(trim(coalesce(p_utm_term, '')), '')),
    utm_content  = COALESCE(NULLIF(utm_content, ''), NULLIF(trim(coalesce(p_utm_content, '')), '')),
    utm_id       = COALESCE(NULLIF(utm_id, ''), NULLIF(trim(coalesce(p_utm_id, '')), '')),
    referrer     = COALESCE(NULLIF(referrer, ''), NULLIF(trim(coalesce(p_referrer, '')), '')),
    landing_page = COALESCE(NULLIF(landing_page, ''), NULLIF(trim(coalesce(p_landing_page, '')), ''))
  WHERE lower(email) = normalized_email;

  RETURN TRUE;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.save_user_attribution(text, text, text, text, text, text, text, text, text, text, text) TO anon, authenticated, service_role;