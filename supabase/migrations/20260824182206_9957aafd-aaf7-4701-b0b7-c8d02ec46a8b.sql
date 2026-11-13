ALTER TABLE public.saas_suite_users ADD COLUMN IF NOT EXISTS fbc text, ADD COLUMN IF NOT EXISTS fbp text;
ALTER TABLE public.signup_attribution_handoffs ADD COLUMN IF NOT EXISTS fbc text, ADD COLUMN IF NOT EXISTS fbp text;

CREATE OR REPLACE FUNCTION public.save_user_attribution(user_email text, p_fbclid text DEFAULT NULL::text, p_gclid text DEFAULT NULL::text, p_utm_source text DEFAULT NULL::text, p_utm_medium text DEFAULT NULL::text, p_utm_campaign text DEFAULT NULL::text, p_utm_term text DEFAULT NULL::text, p_utm_content text DEFAULT NULL::text, p_utm_id text DEFAULT NULL::text, p_referrer text DEFAULT NULL::text, p_landing_page text DEFAULT NULL::text, p_fbc text DEFAULT NULL::text, p_fbp text DEFAULT NULL::text)
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
    landing_page = COALESCE(NULLIF(landing_page, ''), NULLIF(trim(coalesce(p_landing_page, '')), '')),
    fbc          = COALESCE(NULLIF(fbc, ''), NULLIF(trim(coalesce(p_fbc, '')), '')),
    fbp          = COALESCE(NULLIF(fbp, ''), NULLIF(trim(coalesce(p_fbp, '')), ''))
  WHERE lower(email) = normalized_email;

  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.stage_signup_attribution(p_token uuid, p_fbclid text DEFAULT NULL::text, p_gclid text DEFAULT NULL::text, p_utm_source text DEFAULT NULL::text, p_utm_medium text DEFAULT NULL::text, p_utm_campaign text DEFAULT NULL::text, p_utm_term text DEFAULT NULL::text, p_utm_content text DEFAULT NULL::text, p_utm_id text DEFAULT NULL::text, p_referrer text DEFAULT NULL::text, p_landing_page text DEFAULT NULL::text, p_fbc text DEFAULT NULL::text, p_fbp text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_token IS NULL THEN RETURN FALSE; END IF;

  INSERT INTO public.signup_attribution_handoffs (
    token, fbclid, gclid, utm_source, utm_medium, utm_campaign,
    utm_term, utm_content, utm_id, referrer, landing_page, fbc, fbp
  ) VALUES (
    p_token, p_fbclid, p_gclid, p_utm_source, p_utm_medium, p_utm_campaign,
    p_utm_term, p_utm_content, p_utm_id, p_referrer, p_landing_page, p_fbc, p_fbp
  )
  ON CONFLICT (token) DO UPDATE SET
    fbclid = COALESCE(EXCLUDED.fbclid, public.signup_attribution_handoffs.fbclid),
    gclid = COALESCE(EXCLUDED.gclid, public.signup_attribution_handoffs.gclid),
    utm_source = COALESCE(EXCLUDED.utm_source, public.signup_attribution_handoffs.utm_source),
    utm_medium = COALESCE(EXCLUDED.utm_medium, public.signup_attribution_handoffs.utm_medium),
    utm_campaign = COALESCE(EXCLUDED.utm_campaign, public.signup_attribution_handoffs.utm_campaign),
    utm_term = COALESCE(EXCLUDED.utm_term, public.signup_attribution_handoffs.utm_term),
    utm_content = COALESCE(EXCLUDED.utm_content, public.signup_attribution_handoffs.utm_content),
    utm_id = COALESCE(EXCLUDED.utm_id, public.signup_attribution_handoffs.utm_id),
    referrer = COALESCE(EXCLUDED.referrer, public.signup_attribution_handoffs.referrer),
    landing_page = COALESCE(EXCLUDED.landing_page, public.signup_attribution_handoffs.landing_page),
    fbc = COALESCE(EXCLUDED.fbc, public.signup_attribution_handoffs.fbc),
    fbp = COALESCE(EXCLUDED.fbp, public.signup_attribution_handoffs.fbp);

  RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_signup_attribution(p_token uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  auth_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  handoff public.signup_attribution_handoffs%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR auth_email = '' OR p_token IS NULL THEN RETURN FALSE; END IF;

  SELECT * INTO handoff
  FROM public.signup_attribution_handoffs
  WHERE token = p_token AND claimed_at IS NULL AND expires_at > now()
  FOR UPDATE;

  IF handoff.token IS NULL THEN RETURN FALSE; END IF;

  UPDATE public.saas_suite_users
  SET
    fbclid = COALESCE(NULLIF(fbclid, ''), handoff.fbclid),
    gclid = COALESCE(NULLIF(gclid, ''), handoff.gclid),
    utm_source = COALESCE(NULLIF(utm_source, ''), handoff.utm_source),
    utm_medium = COALESCE(NULLIF(utm_medium, ''), handoff.utm_medium),
    utm_campaign = COALESCE(NULLIF(utm_campaign, ''), handoff.utm_campaign),
    utm_term = COALESCE(NULLIF(utm_term, ''), handoff.utm_term),
    utm_content = COALESCE(NULLIF(utm_content, ''), handoff.utm_content),
    utm_id = COALESCE(NULLIF(utm_id, ''), handoff.utm_id),
    referrer = COALESCE(NULLIF(referrer, ''), handoff.referrer),
    landing_page = COALESCE(NULLIF(landing_page, ''), handoff.landing_page),
    fbc = COALESCE(NULLIF(fbc, ''), handoff.fbc),
    fbp = COALESCE(NULLIF(fbp, ''), handoff.fbp)
  WHERE lower(email) = auth_email;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  UPDATE public.signup_attribution_handoffs SET claimed_at = now() WHERE token = p_token;
  RETURN TRUE;
END;
$function$;