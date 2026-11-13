-- Notify Lynkific when a SaaSSuite plan is set or actually changes.
-- Does not update saas_suite_users, and does not change existing policies.
-- pg_net queues the HTTP call and runs it after commit, so the user write
-- is not blocked. Any failure is swallowed.

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

-- Shared secret the trigger sends and the edge function checks.
-- Clients have no policies and no grants. service_role (used by the function)
-- bypasses RLS and is the only role granted SELECT.
CREATE TABLE IF NOT EXISTS public.lynkific_plan_sync_auth (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.lynkific_plan_sync_auth IS
  'Internal secret for the Lynkific plan-sync trigger. No client access.';

ALTER TABLE public.lynkific_plan_sync_auth ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.lynkific_plan_sync_auth FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.lynkific_plan_sync_auth TO service_role;

DROP POLICY IF EXISTS "lynkific plan sync auth deny clients" ON public.lynkific_plan_sync_auth;
CREATE POLICY "lynkific plan sync auth deny clients"
  ON public.lynkific_plan_sync_auth
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

INSERT INTO public.lynkific_plan_sync_auth (id, secret)
SELECT 1, encode(extensions.gen_random_bytes(32), 'hex')
WHERE NOT EXISTS (SELECT 1 FROM public.lynkific_plan_sync_auth WHERE id = 1);

CREATE OR REPLACE FUNCTION private.trg_lynkific_plan_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions, pg_temp
AS $$
DECLARE
  sync_secret text;
  previous_plan text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.plan IS NOT DISTINCT FROM OLD.plan THEN
    RETURN NEW;
  END IF;

  -- Junk enum labels (null / NULL / Null / empty) are not a plan.
  IF NEW.plan::text IS NULL
     OR lower(btrim(NEW.plan::text)) IN ('null', '')
     OR NEW.plan::text NOT IN ('STARTER', 'BASIC', 'ADVANCED') THEN
    RETURN NEW;
  END IF;

  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  previous_plan := NULL;
  IF TG_OP = 'UPDATE'
     AND OLD.plan IS NOT NULL
     AND OLD.plan::text IN ('STARTER', 'BASIC', 'ADVANCED') THEN
    previous_plan := OLD.plan::text;
  END IF;

  SELECT secret INTO sync_secret
  FROM public.lynkific_plan_sync_auth
  WHERE id = 1;

  IF sync_secret IS NULL OR btrim(sync_secret) = '' THEN
    RAISE WARNING 'lynkific plan sync skipped: auth secret missing';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/lynkific-plan-sync',
    body := jsonb_build_object(
      'saassuite_user_id', NEW.id,
      'email', NEW.email,
      'full_name', NEW.full_name,
      'bonuses_phone', NEW.bonuses_phone,
      'plan', NEW.plan::text,
      'previous_plan', previous_plan,
      'agency_id', NEW.agency_id,
      'plan_changed_at', now()
    ),
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', sync_secret
    ),
    timeout_milliseconds := 15000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'lynkific plan sync failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.trg_lynkific_plan_sync() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.trg_lynkific_plan_sync() TO anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_lynkific_plan_sync ON public.saas_suite_users;
CREATE TRIGGER trg_lynkific_plan_sync
AFTER INSERT OR UPDATE OF plan ON public.saas_suite_users
FOR EACH ROW
EXECUTE FUNCTION private.trg_lynkific_plan_sync();

-- So the edge function can read the new auth table immediately.
NOTIFY pgrst, 'reload schema';
