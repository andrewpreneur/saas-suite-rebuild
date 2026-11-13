CREATE TABLE public.signup_attribution_handoffs (
  token uuid PRIMARY KEY,
  fbclid text,
  gclid text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  utm_id text,
  referrer text,
  landing_page text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  claimed_at timestamptz
);

GRANT ALL ON public.signup_attribution_handoffs TO service_role;
ALTER TABLE public.signup_attribution_handoffs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.stage_signup_attribution(
  p_token uuid,
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
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_token IS NULL THEN RETURN FALSE; END IF;

  INSERT INTO public.signup_attribution_handoffs (
    token, fbclid, gclid, utm_source, utm_medium, utm_campaign,
    utm_term, utm_content, utm_id, referrer, landing_page
  ) VALUES (
    p_token,
    left(nullif(trim(coalesce(p_fbclid, '')), ''), 500),
    left(nullif(trim(coalesce(p_gclid, '')), ''), 500),
    left(nullif(trim(coalesce(p_utm_source, '')), ''), 255),
    left(nullif(trim(coalesce(p_utm_medium, '')), ''), 255),
    left(nullif(trim(coalesce(p_utm_campaign, '')), ''), 500),
    left(nullif(trim(coalesce(p_utm_term, '')), ''), 500),
    left(nullif(trim(coalesce(p_utm_content, '')), ''), 500),
    left(nullif(trim(coalesce(p_utm_id, '')), ''), 255),
    left(nullif(trim(coalesce(p_referrer, '')), ''), 2000),
    left(nullif(trim(coalesce(p_landing_page, '')), ''), 2000)
  )
  ON CONFLICT (token) DO UPDATE SET
    fbclid = COALESCE(signup_attribution_handoffs.fbclid, EXCLUDED.fbclid),
    gclid = COALESCE(signup_attribution_handoffs.gclid, EXCLUDED.gclid),
    utm_source = COALESCE(signup_attribution_handoffs.utm_source, EXCLUDED.utm_source),
    utm_medium = COALESCE(signup_attribution_handoffs.utm_medium, EXCLUDED.utm_medium),
    utm_campaign = COALESCE(signup_attribution_handoffs.utm_campaign, EXCLUDED.utm_campaign),
    utm_term = COALESCE(signup_attribution_handoffs.utm_term, EXCLUDED.utm_term),
    utm_content = COALESCE(signup_attribution_handoffs.utm_content, EXCLUDED.utm_content),
    utm_id = COALESCE(signup_attribution_handoffs.utm_id, EXCLUDED.utm_id),
    referrer = COALESCE(signup_attribution_handoffs.referrer, EXCLUDED.referrer),
    landing_page = COALESCE(signup_attribution_handoffs.landing_page, EXCLUDED.landing_page);

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.stage_signup_attribution(uuid,text,text,text,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stage_signup_attribution(uuid,text,text,text,text,text,text,text,text,text,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_signup_attribution(p_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    landing_page = COALESCE(NULLIF(landing_page, ''), handoff.landing_page)
  WHERE lower(email) = auth_email;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  UPDATE public.signup_attribution_handoffs SET claimed_at = now() WHERE token = p_token;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_signup_attribution(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_signup_attribution(uuid) TO authenticated;