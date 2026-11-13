-- Funnel apply rows and a nullable training-lead answer.
-- Ships in the PR only. Do not apply this against the live project from an agent.

ALTER TABLE public.one_feature_training_leads
  ALTER COLUMN has_highlevel DROP NOT NULL;

ALTER TABLE public.one_feature_training_leads
  DROP CONSTRAINT IF EXISTS one_feature_training_leads_phone_check;

ALTER TABLE public.one_feature_training_leads
  ALTER COLUMN phone DROP NOT NULL;

ALTER TABLE public.one_feature_training_leads
  ADD CONSTRAINT one_feature_training_leads_phone_check
  CHECK (phone IS NULL OR char_length(phone) BETWEEN 7 AND 30);

COMMENT ON COLUMN public.one_feature_training_leads.has_highlevel IS
  'Null until the visitor answers. /onefeaturetraining-4 and -5 save the contact row first.';

CREATE TABLE IF NOT EXISTS public.funnel_apply_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  funnel text NOT NULL CHECK (funnel IN ('agents', 'work_with_us', 'highlevelers', 'highlevelers_upgrade')),
  email text,
  phone text,
  name text,
  session_key text NOT NULL CHECK (char_length(session_key) BETWEEN 8 AND 80),
  step text NOT NULL DEFAULT 'start',
  status text NOT NULL DEFAULT 'partial' CHECK (status IN ('partial', 'submitted')),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  landing_url text,
  is_test boolean NOT NULL DEFAULT false,
  handoff_claimed_at timestamptz,
  handoff_sent_at timestamptz,
  UNIQUE (funnel, session_key)
);

COMMENT ON TABLE public.funnel_apply_leads IS
  'Partial and final applications for /agents, /work-with-us, /highlevelers, and /highlevelers-upgrade. Service role writes. No public read.';

COMMENT ON COLUMN public.funnel_apply_leads.session_key IS
  'Client session id. /agents keeps it in localStorage agents_apply_session.';

COMMENT ON COLUMN public.funnel_apply_leads.name IS
  'Optional. /agents does not collect a name, so this stays null.';

CREATE INDEX IF NOT EXISTS funnel_apply_leads_email_idx
  ON public.funnel_apply_leads (funnel, email);

-- One work-with-us row per email. Agents keeps its (funnel, session_key) unique rule.
CREATE UNIQUE INDEX IF NOT EXISTS funnel_apply_leads_work_with_us_email_idx
  ON public.funnel_apply_leads (funnel, lower(email))
  WHERE funnel = 'work_with_us' AND email IS NOT NULL;

-- One HighLevelers row per page and email. The two pages stay separate rows.
CREATE UNIQUE INDEX IF NOT EXISTS funnel_apply_leads_highlevelers_email_idx
  ON public.funnel_apply_leads (funnel, lower(email))
  WHERE funnel IN ('highlevelers', 'highlevelers_upgrade') AND email IS NOT NULL;

-- Google OAuth on /work-with-us cannot set ss_lead_only before this trigger runs,
-- so a brand-new auth user still gets a Starter row. work-with-us-apply sets the
-- flag afterwards and deletes only that fresh STARTER row (source signup, no Stripe
-- customer, created in the last 3 minutes). Existing accounts are left alone.
-- The 15-minute reconciler below skips users once ss_lead_only is set.

ALTER TABLE public.funnel_apply_leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.funnel_apply_leads FROM anon, authenticated;
GRANT ALL ON TABLE public.funnel_apply_leads TO service_role;

-- Lead-only Google/magic-link on /work-with-us may create auth.users.
-- ss_lead_only or signup_source=work_with_us skips the Starter row and the welcome cron,
-- because that cron emails saas_suite_users. The Part A quiz does not set either key,
-- so quiz magic links still create app users.
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
  IF COALESCE(NEW.raw_user_meta_data->>'ss_lead_only', '') IN ('true', '1')
     OR COALESCE(NEW.raw_user_meta_data->>'signup_source', '') = 'work_with_us' THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.register_starter_user(lower(NEW.email), NULL);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.auth_signup_failures (email, error_message)
    VALUES (lower(NEW.email), 'rpc: ' || SQLERRM);
  END;

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

-- The 15-minute reconciler must not recreate a lead-only auth user as a Starter.
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
      AND COALESCE(u.raw_user_meta_data->>'ss_lead_only', '') NOT IN ('true', '1')
      AND COALESCE(u.raw_user_meta_data->>'signup_source', '') <> 'work_with_us'
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
