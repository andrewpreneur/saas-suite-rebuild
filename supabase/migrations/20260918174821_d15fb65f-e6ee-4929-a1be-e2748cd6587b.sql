ALTER TABLE public.agency_support_clients
  ADD COLUMN IF NOT EXISTS client_phone text,
  ADD COLUMN IF NOT EXISTS client_company text,
  ADD COLUMN IF NOT EXISTS location_id text,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;

ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS white_label_domain text;

DROP FUNCTION IF EXISTS public.get_agency_support_clients(text);
DROP FUNCTION IF EXISTS public.delete_agency_support_client(text, text);

CREATE OR REPLACE FUNCTION public.set_white_label_domain(_email text, _domain text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  d text := lower(trim(COALESCE(_domain, '')));
BEGIN
  d := regexp_replace(d, '^https?://', '');
  d := split_part(d, '/', 1);
  d := regexp_replace(d, '[^a-z0-9\.\-:]', '', 'g');
  IF d = '' THEN
    d := NULL;
  END IF;
  UPDATE public.saas_suite_users
     SET white_label_domain = d
   WHERE lower(email) = lower(trim(_email));
  RETURN d;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_agency_support_client(
  _owner_email text,
  _client_email text,
  _client_name text DEFAULT NULL::text,
  _source text DEFAULT 'manual'::text,
  _agency_id text DEFAULT NULL::text,
  _client_phone text DEFAULT NULL::text,
  _client_company text DEFAULT NULL::text,
  _location_id text DEFAULT NULL::text
)
RETURNS public.agency_support_clients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  row_out public.agency_support_clients;
  oe text := lower(trim(_owner_email));
  ce text := lower(trim(_client_email));
  ph text := NULLIF(trim(COALESCE(_client_phone, '')), '');
  co text := NULLIF(trim(COALESCE(_client_company, '')), '');
  lo text := NULLIF(trim(COALESCE(_location_id, '')), '');
  existing public.agency_support_clients;
BEGIN
  IF oe = '' OR ce = '' THEN
    RAISE EXCEPTION 'owner_email and client_email are required';
  END IF;

  SELECT * INTO existing
    FROM public.agency_support_clients
   WHERE lower(owner_email) = oe AND lower(client_email) = ce;

  IF existing.id IS NULL AND (ph IS NULL OR co IS NULL OR lo IS NULL) THEN
    RAISE EXCEPTION 'phone, company and location_id are required';
  END IF;

  INSERT INTO public.agency_support_clients (
    owner_email, client_email, client_name, source, agency_id,
    client_phone, client_company, location_id
  )
  VALUES (
    oe, ce, NULLIF(trim(COALESCE(_client_name, '')), ''), COALESCE(_source, 'manual'), _agency_id,
    ph, co, lo
  )
  ON CONFLICT (lower(owner_email), lower(client_email))
  DO UPDATE SET
    client_name = COALESCE(NULLIF(trim(COALESCE(EXCLUDED.client_name, '')), ''), public.agency_support_clients.client_name),
    agency_id = COALESCE(EXCLUDED.agency_id, public.agency_support_clients.agency_id),
    client_phone = COALESCE(EXCLUDED.client_phone, public.agency_support_clients.client_phone),
    client_company = COALESCE(EXCLUDED.client_company, public.agency_support_clients.client_company),
    location_id = COALESCE(EXCLUDED.location_id, public.agency_support_clients.location_id)
  RETURNING * INTO row_out;

  RETURN row_out;
END;
$function$;

CREATE FUNCTION public.get_agency_support_clients(_owner_email text)
RETURNS TABLE(
  id uuid,
  client_email text,
  client_name text,
  agency_id text,
  active boolean,
  source text,
  assigned_at timestamp with time zone,
  created_at timestamp with time zone,
  client_phone text,
  client_company text,
  location_id text,
  locked_until timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT c.id, c.client_email, c.client_name, c.agency_id, c.active, c.source,
         c.assigned_at, c.created_at, c.client_phone, c.client_company,
         c.location_id, c.locked_until
    FROM public.agency_support_clients c
   WHERE lower(c.owner_email) = lower(trim(_owner_email))
   ORDER BY c.active DESC, c.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.set_agency_support_client_active(_owner_email text, _client_email text, _active boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  oe text := lower(trim(_owner_email));
  ce text := lower(trim(_client_email));
  seats integer := 0;
  used integer := 0;
  row_existing public.agency_support_clients;
BEGIN
  SELECT * INTO row_existing
    FROM public.agency_support_clients
   WHERE lower(owner_email) = oe AND lower(client_email) = ce;

  IF row_existing.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'client_not_found');
  END IF;

  IF NOT _active AND row_existing.active
     AND row_existing.locked_until IS NOT NULL
     AND row_existing.locked_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'locked', 'locked_until', row_existing.locked_until);
  END IF;

  IF _active AND (row_existing.client_phone IS NULL
                  OR row_existing.client_company IS NULL
                  OR row_existing.location_id IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_details');
  END IF;

  SELECT COALESCE(agency_support_wallet, 0) INTO seats
    FROM public.saas_suite_users WHERE lower(email) = oe;

  SELECT count(*) INTO used
    FROM public.agency_support_clients
   WHERE lower(owner_email) = oe AND active AND lower(client_email) <> ce;

  IF _active AND used >= COALESCE(seats, 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_seats_available', 'seats', COALESCE(seats, 0), 'used', used);
  END IF;

  UPDATE public.agency_support_clients
     SET active = _active,
         assigned_at = CASE WHEN _active THEN now() ELSE NULL END,
         locked_until = CASE WHEN _active THEN now() + interval '30 days' ELSE NULL END
   WHERE id = row_existing.id;

  RETURN jsonb_build_object(
    'ok', true,
    'seats', COALESCE(seats, 0),
    'used', used + CASE WHEN _active THEN 1 ELSE 0 END,
    'locked_until', CASE WHEN _active THEN now() + interval '30 days' ELSE NULL END
  );
END;
$function$;

CREATE FUNCTION public.delete_agency_support_client(_owner_email text, _client_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  row_existing public.agency_support_clients;
BEGIN
  SELECT * INTO row_existing
    FROM public.agency_support_clients
   WHERE lower(owner_email) = lower(trim(_owner_email))
     AND lower(client_email) = lower(trim(_client_email));

  IF row_existing.id IS NULL THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF row_existing.active AND row_existing.locked_until IS NOT NULL AND row_existing.locked_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'locked', 'locked_until', row_existing.locked_until);
  END IF;

  DELETE FROM public.agency_support_clients WHERE id = row_existing.id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_agency_support_accounts()
RETURNS TABLE(
  owner_email text,
  owner_name text,
  plan text,
  agency_id text,
  white_label_domain text,
  seats integer,
  assigned integer,
  clients jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF lower(COALESCE(public.current_auth_email(), '')) <> 'andrew@dna-media.net' THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  WITH owners AS (
    SELECT lower(u.email) AS oe,
           u.full_name AS full_name,
           u.plan::text AS plan,
           u.agency_id AS agency_id,
           u.white_label_domain AS white_label_domain,
           COALESCE(u.agency_support_wallet, 0)::int AS seats
      FROM public.saas_suite_users u
     WHERE COALESCE(u.agency_support_wallet, 0) > 0
        OR lower(u.email) IN (SELECT lower(c.owner_email) FROM public.agency_support_clients c)
  )
  SELECT o.oe,
         o.full_name,
         o.plan,
         o.agency_id,
         o.white_label_domain,
         o.seats,
         COALESCE((SELECT count(*)::int FROM public.agency_support_clients c
                    WHERE lower(c.owner_email) = o.oe AND c.active), 0),
         COALESCE((SELECT jsonb_agg(jsonb_build_object(
                     'id', c.id,
                     'client_email', c.client_email,
                     'client_name', c.client_name,
                     'client_phone', c.client_phone,
                     'client_company', c.client_company,
                     'location_id', c.location_id,
                     'active', c.active,
                     'assigned_at', c.assigned_at,
                     'locked_until', c.locked_until,
                     'created_at', c.created_at
                   ) ORDER BY c.active DESC, c.created_at DESC)
                   FROM public.agency_support_clients c
                  WHERE lower(c.owner_email) = o.oe), '[]'::jsonb)
    FROM owners o
   ORDER BY o.seats DESC, o.oe;
END;
$function$;