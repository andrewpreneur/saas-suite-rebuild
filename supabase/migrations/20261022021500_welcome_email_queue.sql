-- Welcome email queue. Additive only. Not applied by the pull request.
-- Accounts created before 2026-10-22 02:00 UTC are not emailed unless
-- welcome_email_force is set for that row. This file does not set that flag.

ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS welcome_email_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS welcome_email_next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS welcome_email_last_error text,
  ADD COLUMN IF NOT EXISTS welcome_email_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS welcome_email_force boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.saas_suite_users.welcome_email_attempts IS
  'Failed account-welcome webhook attempts. Stops at 5. Not a sent stamp.';
COMMENT ON COLUMN public.saas_suite_users.welcome_email_force IS
  'Include this row in the welcome cron even when it was created before the cutover or its source is internal/admin_granted. Does not clear welcome_ai_email_sent_at.';

CREATE INDEX IF NOT EXISTS saas_suite_users_welcome_pending_idx
  ON public.saas_suite_users (created_at)
  WHERE welcome_ai_email_sent_at IS NULL;

-- Clients can update their own account row. Keep the queue columns server-only
-- so a customer cannot queue or replay the welcome. The SQL editor (no JWT)
-- and the service role can still write them.
CREATE OR REPLACE FUNCTION public.guard_welcome_email_queue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL AND coalesce(auth.role(), '') = '' THEN
    RETURN NEW;
  END IF;
  NEW.welcome_email_attempts := OLD.welcome_email_attempts;
  NEW.welcome_email_next_attempt_at := OLD.welcome_email_next_attempt_at;
  NEW.welcome_email_last_error := OLD.welcome_email_last_error;
  NEW.welcome_email_claimed_at := OLD.welcome_email_claimed_at;
  NEW.welcome_email_force := OLD.welcome_email_force;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_welcome_email_queue() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_welcome_email_queue ON public.saas_suite_users;
CREATE TRIGGER trg_guard_welcome_email_queue
  BEFORE UPDATE ON public.saas_suite_users
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_welcome_email_queue();

CREATE TABLE IF NOT EXISTS public.welcome_email_cron_auth (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.welcome_email_cron_auth IS
  'Secret the welcome cron sends. No client access.';

ALTER TABLE public.welcome_email_cron_auth ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.welcome_email_cron_auth FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.welcome_email_cron_auth TO service_role;

DROP POLICY IF EXISTS "welcome email cron auth deny clients" ON public.welcome_email_cron_auth;
CREATE POLICY "welcome email cron auth deny clients"
  ON public.welcome_email_cron_auth
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

INSERT INTO public.welcome_email_cron_auth (id, secret)
SELECT 1, encode(extensions.gen_random_bytes(32), 'hex')
WHERE NOT EXISTS (SELECT 1 FROM public.welcome_email_cron_auth WHERE id = 1);

CREATE OR REPLACE FUNCTION public.invoke_send_pending_welcome()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions, pg_temp
AS $$
DECLARE
  cron_secret text;
BEGIN
  SELECT secret INTO cron_secret FROM public.welcome_email_cron_auth WHERE id = 1;
  IF cron_secret IS NULL OR btrim(cron_secret) = '' THEN
    RAISE WARNING 'welcome email cron skipped: auth secret missing';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/send-pending-welcome',
    body := '{"source":"cron"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', cron_secret
    ),
    timeout_milliseconds := 15000
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'welcome email cron invoke failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_send_pending_welcome() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_send_pending_welcome() TO service_role;

SELECT cron.unschedule('send-pending-welcome')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-pending-welcome');

SELECT cron.schedule(
  'send-pending-welcome',
  '*/5 * * * *',
  $$SELECT public.invoke_send_pending_welcome();$$
);

-- List the backlog (created before the cutover, welcome never stamped).
-- This SELECT does not send anything.
-- SELECT id, email, full_name, plan, source, approval, created_at, login_count, last_login_at
-- FROM public.saas_suite_users
-- WHERE welcome_ai_email_sent_at IS NULL
--   AND created_at < timestamptz '2026-10-22 02:00:00+00'
--   AND email IS NOT NULL
--   AND coalesce(lower(source), '') NOT IN ('internal', 'admin_granted')
-- ORDER BY created_at DESC;

-- Queue specific backlog rows. The cron sends them on its next run.
-- Does not clear a welcome that was already stamped.
-- UPDATE public.saas_suite_users
-- SET welcome_email_force = true,
--     welcome_email_attempts = 0,
--     welcome_email_next_attempt_at = NULL,
--     welcome_email_last_error = NULL,
--     welcome_email_claimed_at = NULL
-- WHERE welcome_ai_email_sent_at IS NULL
--   AND lower(email) IN ('person@example.com');

NOTIFY pgrst, 'reload schema';
