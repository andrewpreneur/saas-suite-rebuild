ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS agency_support_wallet integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agency_support_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agency_support_subscription_id text;

CREATE TABLE IF NOT EXISTS public.agency_support_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_email text NOT NULL,
  client_email text NOT NULL,
  client_name text,
  agency_id text,
  active boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual',
  assigned_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_support_clients TO authenticated;
GRANT ALL ON public.agency_support_clients TO service_role;

ALTER TABLE public.agency_support_clients ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS agency_support_clients_owner_client_uidx
  ON public.agency_support_clients (lower(owner_email), lower(client_email));
CREATE INDEX IF NOT EXISTS agency_support_clients_client_idx
  ON public.agency_support_clients (lower(client_email));

CREATE POLICY "Owners manage their agency support clients"
  ON public.agency_support_clients
  FOR ALL
  TO authenticated
  USING (lower(owner_email) = lower(public.current_auth_email()))
  WITH CHECK (lower(owner_email) = lower(public.current_auth_email()));

CREATE POLICY "Clients can read their own agency support row"
  ON public.agency_support_clients
  FOR SELECT
  TO authenticated
  USING (lower(client_email) = lower(public.current_auth_email()));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_agency_support_clients_updated_at ON public.agency_support_clients;
CREATE TRIGGER update_agency_support_clients_updated_at
  BEFORE UPDATE ON public.agency_support_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Wallet: incremental top-up (one-off / manual credit)
CREATE OR REPLACE FUNCTION public.add_agency_support_seats(_email text, _amount integer)
RETURNS TABLE(email text, agency_support_wallet integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.saas_suite_users u
     SET agency_support_wallet = GREATEST(0, COALESCE(u.agency_support_wallet, 0) + COALESCE(_amount, 0)),
         agency_support_access = true
   WHERE lower(u.email) = lower(_email);

  RETURN QUERY
  SELECT u.email, u.agency_support_wallet
    FROM public.saas_suite_users u
   WHERE lower(u.email) = lower(_email);
END;
$$;

-- Wallet: absolute set (Stripe subscription quantity is the source of truth)
CREATE OR REPLACE FUNCTION public.set_agency_support_wallet(
  _email text,
  _quantity integer,
  _subscription_id text DEFAULT NULL
)
RETURNS TABLE(email text, agency_support_wallet integer, agency_support_access boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qty integer := GREATEST(0, COALESCE(_quantity, 0));
BEGIN
  UPDATE public.saas_suite_users u
     SET agency_support_wallet = qty,
         agency_support_access = (qty > 0),
         agency_support_subscription_id = COALESCE(_subscription_id, u.agency_support_subscription_id)
   WHERE lower(u.email) = lower(_email);

  -- If seats were reduced below what is allocated, deactivate the newest allocations.
  UPDATE public.agency_support_clients c
     SET active = false
   WHERE c.id IN (
     SELECT id FROM public.agency_support_clients
      WHERE lower(owner_email) = lower(_email) AND active
      ORDER BY assigned_at DESC NULLS LAST, created_at DESC
      OFFSET qty
   );

  RETURN QUERY
  SELECT u.email, u.agency_support_wallet, u.agency_support_access
    FROM public.saas_suite_users u
   WHERE lower(u.email) = lower(_email);
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_agency_support_client(
  _owner_email text,
  _client_email text,
  _client_name text DEFAULT NULL,
  _source text DEFAULT 'manual',
  _agency_id text DEFAULT NULL
)
RETURNS public.agency_support_clients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_out public.agency_support_clients;
  oe text := lower(trim(_owner_email));
  ce text := lower(trim(_client_email));
BEGIN
  IF oe = '' OR ce = '' THEN
    RAISE EXCEPTION 'owner_email and client_email are required';
  END IF;

  INSERT INTO public.agency_support_clients (owner_email, client_email, client_name, source, agency_id)
  VALUES (oe, ce, NULLIF(trim(COALESCE(_client_name, '')), ''), COALESCE(_source, 'manual'), _agency_id)
  ON CONFLICT (lower(owner_email), lower(client_email))
  DO UPDATE SET
    client_name = COALESCE(NULLIF(trim(COALESCE(EXCLUDED.client_name, '')), ''), public.agency_support_clients.client_name),
    agency_id = COALESCE(EXCLUDED.agency_id, public.agency_support_clients.agency_id)
  RETURNING * INTO row_out;

  RETURN row_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_agency_support_client_active(
  _owner_email text,
  _client_email text,
  _active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  oe text := lower(trim(_owner_email));
  ce text := lower(trim(_client_email));
  seats integer := 0;
  used integer := 0;
BEGIN
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
         assigned_at = CASE WHEN _active THEN now() ELSE NULL END
   WHERE lower(owner_email) = oe AND lower(client_email) = ce;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'client_not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'seats', COALESCE(seats, 0),
    'used', used + CASE WHEN _active THEN 1 ELSE 0 END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_agency_support_client(_owner_email text, _client_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.agency_support_clients
   WHERE lower(owner_email) = lower(trim(_owner_email))
     AND lower(client_email) = lower(trim(_client_email));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_agency_support_clients(_owner_email text)
RETURNS TABLE(
  id uuid,
  client_email text,
  client_name text,
  agency_id text,
  active boolean,
  source text,
  assigned_at timestamp with time zone,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.client_email, c.client_name, c.agency_id, c.active, c.source, c.assigned_at, c.created_at
    FROM public.agency_support_clients c
   WHERE lower(c.owner_email) = lower(trim(_owner_email))
   ORDER BY c.active DESC, c.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.has_agency_support_access(_client_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agency_support_clients c
     WHERE lower(c.client_email) = lower(trim(_client_email))
       AND c.active
  );
$$;

GRANT EXECUTE ON FUNCTION public.add_agency_support_seats(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_agency_support_wallet(text, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_agency_support_client(text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_agency_support_client_active(text, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_agency_support_client(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_agency_support_clients(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_agency_support_access(text) TO anon, authenticated, service_role;