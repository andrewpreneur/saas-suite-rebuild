-- 1) Self-healing reconciler: creates any missing Starter rows for auth users
CREATE OR REPLACE FUNCTION public.reconcile_missing_starter_users()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  created integer := 0;
BEGIN
  FOR r IN
    SELECT lower(u.email) AS email, u.raw_user_meta_data->>'full_name' AS full_name, u.created_at
    FROM auth.users u
    LEFT JOIN public.saas_suite_users s ON lower(s.email) = lower(u.email)
    WHERE s.email IS NULL
      AND u.email IS NOT NULL
      AND u.created_at >= now() - interval '30 days'
  LOOP
    BEGIN
      INSERT INTO public.saas_suite_users
        (email, approval, plan, trial_start_date, source, max_onboarding_users, full_name, created_at)
      VALUES (r.email, 'YES', 'STARTER', NULL, 'signup', 1, r.full_name, r.created_at);
      created := created + 1;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.auth_signup_failures (email, error_message)
      VALUES (r.email, 'reconcile: ' || SQLERRM);
    END;
  END LOOP;

  RETURN created;
END;
$$;

-- 2) Harden the signup trigger: if the RPC fails for any reason, insert the row directly
CREATE OR REPLACE FUNCTION public.handle_new_auth_user_starter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.register_starter_user(lower(NEW.email), NULL);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.auth_signup_failures (email, error_message)
    VALUES (lower(NEW.email), 'rpc: ' || SQLERRM);
  END;

  -- Guaranteed fallback: never leave an auth user without an app row
  IF NOT EXISTS (
    SELECT 1 FROM public.saas_suite_users WHERE lower(email) = lower(NEW.email)
  ) THEN
    BEGIN
      INSERT INTO public.saas_suite_users
        (email, approval, plan, trial_start_date, source, max_onboarding_users, full_name)
      VALUES (lower(NEW.email), 'YES', 'STARTER', NULL, 'signup', 1,
              NEW.raw_user_meta_data->>'full_name');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.auth_signup_failures (email, error_message)
      VALUES (lower(NEW.email), 'fallback: ' || SQLERRM);
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Track whether the first-login AI follow-up email has been sent
ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS welcome_ai_email_sent_at timestamptz;

-- 4) Run the reconciler every 15 minutes as a safety net
SELECT cron.unschedule('reconcile-missing-starter-users')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-missing-starter-users');

SELECT cron.schedule(
  'reconcile-missing-starter-users',
  '*/15 * * * *',
  $$ SELECT public.reconcile_missing_starter_users(); $$
);

-- 5) Sweep stale activity sessions every 10 minutes so the AI follow-up email always fires
SELECT cron.unschedule('sweep-user-sessions')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-user-sessions');

SELECT cron.schedule(
  'sweep-user-sessions',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/sweep-user-sessions',
    headers := '{"Content-Type":"application/json","apikey":"disconnected"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  );
  $$
);