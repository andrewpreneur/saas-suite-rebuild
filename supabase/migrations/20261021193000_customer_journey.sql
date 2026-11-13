-- Customer journey log.
-- Additive only. New tables are service-role writes with RLS and no anon/authenticated access.
-- Logging failures in the functions that write these tables are caught in application code.
-- Does not change plan, billing, or access rules.

-- ---------------------------------------------------------------------------
-- 1. Every email, SMS, or GoHighLevel webhook that is meant to message a customer
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_message_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status_at timestamptz NOT NULL DEFAULT now(),
  user_email text,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'webhook')),
  template_key text,
  subject text,
  provider text,
  provider_message_id text,
  status text NOT NULL CHECK (status IN (
    'queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'complained', 'suppressed'
  )),
  source text NOT NULL,
  detail text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.customer_message_events IS
  'One row per customer message we attempted (email, sms, or a webhook that triggers one). Status is updated when a provider reports delivery.';

CREATE INDEX IF NOT EXISTS customer_message_events_email_created_idx
  ON public.customer_message_events (lower(user_email), created_at DESC);
CREATE INDEX IF NOT EXISTS customer_message_events_provider_message_idx
  ON public.customer_message_events (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE public.customer_message_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_message_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.customer_message_events TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Checkout sessions, including ones that were never paid
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  stripe_checkout_session_id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  email text,
  plan text,
  billing_interval text CHECK (billing_interval IN ('monthly', 'annual', 'one_time')),
  flow text CHECK (flow IN (
    'subscription', 'one_feature_kit', 'onboarding_call', 'course', 'addon', 'agency_support', 'autopay', 'copilot'
  )),
  surface text,
  page text,
  button text,
  amount_cents integer,
  currency text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'expired', 'abandoned', 'failed')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.checkout_sessions IS
  'One row per Stripe Checkout Session. status open is still in progress. A session left open for more than 24 hours is reported as abandoned by customer_timeline. Stripe expiry is stored as expired.';

CREATE INDEX IF NOT EXISTS checkout_sessions_email_created_idx
  ON public.checkout_sessions (lower(email), created_at DESC);

ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.checkout_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.checkout_sessions TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Plan and billing-state history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plan_change_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id bigint,
  user_email text,
  old_plan text,
  new_plan text,
  old_billing_state text,
  new_billing_state text,
  source text NOT NULL DEFAULT 'database',
  actor text
);

COMMENT ON TABLE public.plan_change_history IS
  'Each plan or billing_state change on saas_suite_users. History starts when this migration is applied. The initial row for a new account has a null old plan.';

CREATE INDEX IF NOT EXISTS plan_change_history_email_created_idx
  ON public.plan_change_history (lower(user_email), created_at DESC);

ALTER TABLE public.plan_change_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.plan_change_history FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.plan_change_history TO service_role;

CREATE OR REPLACE FUNCTION public.log_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.plan IS NOT DISTINCT FROM NEW.plan
     AND OLD.billing_state IS NOT DISTINCT FROM NEW.billing_state THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.plan_change_history (
      user_id, user_email, old_plan, new_plan, old_billing_state, new_billing_state, source, actor
    ) VALUES (
      NEW.id,
      NEW.email,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.plan::text END,
      NEW.plan::text,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.billing_state END,
      NEW.billing_state,
      coalesce(nullif(current_setting('saassuite.plan_change_source', true), ''), 'database'),
      coalesce(
        nullif(current_setting('saassuite.plan_change_actor', true), ''),
        nullif(auth.jwt() ->> 'email', ''),
        session_user
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'plan_change_history insert failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_plan_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_log_plan_change ON public.saas_suite_users;
CREATE TRIGGER trg_log_plan_change
  AFTER INSERT OR UPDATE OF plan, billing_state ON public.saas_suite_users
  FOR EACH ROW
  EXECUTE FUNCTION public.log_plan_change();

-- ---------------------------------------------------------------------------
-- 4. Last-touch attribution. Existing columns stay first-touch.
-- ---------------------------------------------------------------------------
ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS last_landing_page text,
  ADD COLUMN IF NOT EXISTS last_referrer text,
  ADD COLUMN IF NOT EXISTS last_utm_source text,
  ADD COLUMN IF NOT EXISTS last_utm_medium text,
  ADD COLUMN IF NOT EXISTS last_utm_campaign text,
  ADD COLUMN IF NOT EXISTS last_utm_term text,
  ADD COLUMN IF NOT EXISTS last_utm_content text,
  ADD COLUMN IF NOT EXISTS last_utm_id text,
  ADD COLUMN IF NOT EXISTS last_fbclid text,
  ADD COLUMN IF NOT EXISTS last_gclid text,
  ADD COLUMN IF NOT EXISTS last_touch_at timestamptz;

CREATE OR REPLACE FUNCTION public.save_user_last_touch(
  user_email text,
  p_landing_page text DEFAULT NULL,
  p_referrer text DEFAULT NULL,
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL,
  p_utm_term text DEFAULT NULL,
  p_utm_content text DEFAULT NULL,
  p_utm_id text DEFAULT NULL,
  p_fbclid text DEFAULT NULL,
  p_gclid text DEFAULT NULL,
  p_touched_at timestamptz DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_email text := lower(btrim(coalesce(user_email, '')));
  auth_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
BEGIN
  IF auth.uid() IS NULL OR normalized_email = '' OR auth_email = '' OR auth_email <> normalized_email THEN
    RETURN FALSE;
  END IF;

  UPDATE public.saas_suite_users
  SET
    last_landing_page = coalesce(nullif(btrim(coalesce(p_landing_page, '')), ''), last_landing_page),
    last_referrer = coalesce(nullif(btrim(coalesce(p_referrer, '')), ''), last_referrer),
    last_utm_source = coalesce(nullif(btrim(coalesce(p_utm_source, '')), ''), last_utm_source),
    last_utm_medium = coalesce(nullif(btrim(coalesce(p_utm_medium, '')), ''), last_utm_medium),
    last_utm_campaign = coalesce(nullif(btrim(coalesce(p_utm_campaign, '')), ''), last_utm_campaign),
    last_utm_term = coalesce(nullif(btrim(coalesce(p_utm_term, '')), ''), last_utm_term),
    last_utm_content = coalesce(nullif(btrim(coalesce(p_utm_content, '')), ''), last_utm_content),
    last_utm_id = coalesce(nullif(btrim(coalesce(p_utm_id, '')), ''), last_utm_id),
    last_fbclid = coalesce(nullif(btrim(coalesce(p_fbclid, '')), ''), last_fbclid),
    last_gclid = coalesce(nullif(btrim(coalesce(p_gclid, '')), ''), last_gclid),
    last_touch_at = coalesce(p_touched_at, now())
  WHERE lower(email) = normalized_email;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.save_user_last_touch(text, text, text, text, text, text, text, text, text, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_user_last_touch(text, text, text, text, text, text, text, text, text, text, text, timestamptz) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Logins
-- last_login_at defaulted to now() at insert, so it equalled signup time even
-- when login_count stayed 0. The counter also skipped that first window, and
-- the app could drop the call when a token refresh loaded the session first.
-- ---------------------------------------------------------------------------
ALTER TABLE public.saas_suite_users
  ALTER COLUMN last_login_at SET DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  logged_in_at timestamptz NOT NULL DEFAULT now(),
  user_id bigint,
  user_email text,
  auth_user_id uuid,
  auth_audit_id uuid,
  source text NOT NULL,
  provider text
);

COMMENT ON TABLE public.login_events IS
  'One row per counted sign-in. auth_audit rows are the historical backfill from auth.audit_log_entries. Later rows are written by record_user_login.';

CREATE UNIQUE INDEX IF NOT EXISTS login_events_auth_audit_id_idx
  ON public.login_events (auth_audit_id)
  WHERE auth_audit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS login_events_email_logged_idx
  ON public.login_events (lower(user_email), logged_in_at DESC);

ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.login_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.login_events TO service_role;

CREATE OR REPLACE FUNCTION public.record_user_login(user_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_record record;
  normalized_email text;
  days_since_last_login integer;
  is_weekly_active boolean;
  should_count boolean;
BEGIN
  normalized_email := lower(btrim(user_email));

  IF normalized_email IS NULL OR normalized_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email cannot be empty');
  END IF;

  SELECT id, last_login_at, login_count, weekly_login_count, weekly_login_reset_at
  INTO user_record
  FROM public.saas_suite_users
  WHERE lower(email) = normalized_email
  ORDER BY id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM public.register_starter_user(normalized_email, NULL);

    SELECT id, last_login_at, login_count, weekly_login_count, weekly_login_reset_at
    INTO user_record
    FROM public.saas_suite_users
    WHERE lower(email) = normalized_email
    ORDER BY id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;
  END IF;

  days_since_last_login := COALESCE(
    EXTRACT(DAY FROM (now() - user_record.last_login_at))::integer,
    0
  );

  -- A zero count means we have never recorded a login. The column default used
  -- to stamp last_login_at at signup, which made the 30-minute gap look closed.
  should_count := COALESCE(user_record.login_count, 0) = 0
    OR user_record.last_login_at IS NULL
    OR (now() - user_record.last_login_at) > interval '30 minutes';

  IF NOT should_count THEN
    UPDATE public.saas_suite_users
    SET last_accessed = now()
    WHERE id = user_record.id;
  ELSIF user_record.weekly_login_reset_at IS NULL
     OR (now() - user_record.weekly_login_reset_at) > interval '7 days' THEN
    UPDATE public.saas_suite_users
    SET last_login_at = now(),
        last_accessed = now(),
        login_count = COALESCE(login_count, 0) + 1,
        weekly_login_count = 1,
        weekly_login_reset_at = now()
    WHERE id = user_record.id;
  ELSE
    UPDATE public.saas_suite_users
    SET last_login_at = now(),
        last_accessed = now(),
        login_count = COALESCE(login_count, 0) + 1,
        weekly_login_count = COALESCE(weekly_login_count, 0) + 1
    WHERE id = user_record.id;
  END IF;

  IF should_count THEN
    BEGIN
      INSERT INTO public.login_events (user_id, user_email, logged_in_at, source)
      VALUES (user_record.id, normalized_email, now(), 'app');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'login_events insert failed: %', SQLERRM;
    END;
  END IF;

  SELECT weekly_login_count >= 3 INTO is_weekly_active
  FROM public.saas_suite_users
  WHERE id = user_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'counted', should_count,
    'days_inactive', days_since_last_login,
    'weekly_active', COALESCE(is_weekly_active, false)
  );
END;
$$;

-- Historical sign-ins already stored by Supabase Auth. This does not invent visits.
INSERT INTO public.login_events (user_id, user_email, auth_user_id, auth_audit_id, logged_in_at, source, provider)
SELECT u.id,
       lower(au.email),
       au.id,
       a.id,
       a.created_at,
       'auth_audit',
       a.payload #>> '{traits,provider}'
FROM auth.audit_log_entries a
JOIN auth.users au ON au.id = (a.payload ->> 'actor_id')::uuid
LEFT JOIN LATERAL (
  SELECT s.id
  FROM public.saas_suite_users s
  WHERE lower(s.email) = lower(au.email)
  ORDER BY s.id
  LIMIT 1
) u ON true
WHERE a.payload ->> 'action' = 'login'
  AND au.email IS NOT NULL
  AND (a.payload ->> 'actor_id') ~* '^[0-9a-f-]{36}$'
ON CONFLICT (auth_audit_id) WHERE auth_audit_id IS NOT NULL DO NOTHING;

-- Counter repair. Triggers are off for this statement so ensure_agency_id cannot
-- rename a placeholder agency id while we only touch login columns.
-- login_count is never decreased. last_login_at only moves forward, or off the
-- signup-time default when that default is all the row has.
ALTER TABLE public.saas_suite_users DISABLE TRIGGER USER;
UPDATE public.saas_suite_users s
SET
  login_count = GREATEST(COALESCE(s.login_count, 0), c.cnt),
  last_login_at = CASE
    WHEN s.last_login_at IS NULL THEN c.last_at
    WHEN s.last_login_at <= s.created_at + interval '2 seconds' THEN c.last_at
    WHEN c.last_at > s.last_login_at THEN c.last_at
    ELSE s.last_login_at
  END
FROM (
  SELECT lower(user_email) AS email, count(*)::integer AS cnt, max(logged_in_at) AS last_at
  FROM public.login_events
  WHERE source = 'auth_audit'
  GROUP BY 1
) c
WHERE lower(s.email) = c.email
  AND (
    COALESCE(s.login_count, 0) < c.cnt
    OR s.last_login_at IS NULL
    OR s.last_login_at <= s.created_at + interval '2 seconds'
    OR c.last_at > s.last_login_at
  );
ALTER TABLE public.saas_suite_users ENABLE TRIGGER USER;

-- ---------------------------------------------------------------------------
-- 6. One chronological timeline per customer
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_timeline(p_email text)
RETURNS TABLE (
  occurred_at timestamptz,
  source text,
  event_type text,
  status text,
  title text,
  detail text,
  email text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH person AS (
    SELECT lower(btrim(coalesce(p_email, ''))) AS email
  )
  SELECT * FROM (
    SELECT m.created_at AS occurred_at, 'customer_message_events'::text AS source, m.channel AS event_type, m.status,
           coalesce(m.template_key, m.subject, m.provider) AS title,
           left(concat_ws(' · ', m.provider, m.subject, m.detail), 240) AS detail,
           m.user_email AS email
    FROM public.customer_message_events m, person p
    WHERE p.email <> '' AND lower(m.user_email) = p.email

    UNION ALL
    SELECT c.created_at, 'checkout_sessions', coalesce(c.flow, 'checkout'),
           CASE
             WHEN c.status = 'open' AND c.created_at < now() - interval '24 hours' THEN 'abandoned'
             ELSE c.status
           END,
           concat_ws(' ', c.plan, c.billing_interval),
           left(concat_ws(' · ', c.surface, c.page, c.button), 240),
           c.email
    FROM public.checkout_sessions c, person p
    WHERE p.email <> '' AND lower(c.email) = p.email

    UNION ALL
    SELECT h.created_at, 'plan_change_history', 'plan_change', h.new_billing_state,
           concat_ws(' → ', coalesce(h.old_plan, '(none)'), coalesce(h.new_plan, '(none)')),
           left(concat_ws(' · ', h.source, h.actor), 240),
           h.user_email
    FROM public.plan_change_history h, person p
    WHERE p.email <> '' AND lower(h.user_email) = p.email

    UNION ALL
    SELECT l.logged_in_at, 'login_events', 'login', l.source,
           coalesce(l.provider, l.source),
           l.source,
           l.user_email
    FROM public.login_events l, person p
    WHERE p.email <> '' AND lower(l.user_email) = p.email

    UNION ALL
    SELECT e.created_at, 'site_analytics_events', e.event_type, NULL,
           left(concat_ws(' ', e.path, e.label), 240),
           left(concat_ws(' · ', e.utm_source, e.utm_campaign, e.referrer), 240),
           e.user_email
    FROM public.site_analytics_events e, person p
    WHERE p.email <> '' AND lower(e.user_email) = p.email

    UNION ALL
    SELECT w.created_at, 'webinar_registrations', 'registration', w.attendance_status,
           w.webinar_id,
           left(concat_ws(' · ', w.landing_page, w.utm_source, w.utm_campaign), 240),
           w.email
    FROM public.webinar_registrations w, person p
    WHERE p.email <> '' AND lower(w.email) = p.email

    UNION ALL
    SELECT f.created_at, 'followup_email_log', f.email_type,
           CASE WHEN f.sent THEN 'sent' ELSE 'suppressed' END,
           f.subject,
           left(coalesce(f.suppressed_reason, f.user_health), 240),
           f.user_email
    FROM public.followup_email_log f, person p
    WHERE p.email <> '' AND lower(f.user_email) = p.email

    UNION ALL
    SELECT t.created_at, 'support_tickets', 'ticket', t.status,
           left(concat_ws(' ', '#' || t.ticket_number::text, t.issue_category), 240),
           left(t.request_text, 240),
           t.customer_email
    FROM public.support_tickets t, person p
    WHERE p.email <> '' AND lower(t.customer_email) = p.email

    UNION ALL
    SELECT r.created_at, 'support_ticket_replies', 'ticket_reply', r.sender_role,
           left(r.sender_role, 80),
           left(r.body, 240),
           t.customer_email
    FROM public.support_ticket_replies r
    JOIN public.support_tickets t ON t.id = r.ticket_id
    JOIN person p ON p.email <> '' AND lower(t.customer_email) = p.email

    UNION ALL
    SELECT a.created_at, 'ai_chat_messages', 'chat', a.role,
           left(a.role, 40),
           left(a.content, 240),
           a.user_identifier
    FROM public.ai_chat_messages a, person p
    WHERE p.email <> '' AND lower(a.user_identifier) = p.email

    UNION ALL
    SELECT c.created_at, 'copilot_chat_messages', 'copilot', c.role,
           left(c.role, 40),
           left(c.content, 240),
           c.owner_email
    FROM public.copilot_chat_messages c, person p
    WHERE p.email <> '' AND lower(c.owner_email) = p.email

    UNION ALL
    SELECT k.created_at, 'kit_purchases', 'kit_purchase', k.source,
           k.line_id,
           left(concat_ws(' · ', k.checkout_session_id, k.amount_cents::text), 240),
           k.email
    FROM public.kit_purchases k, person p
    WHERE p.email <> '' AND lower(k.email) = p.email

    UNION ALL
    SELECT e.created_at, 'kit_events', e.event, e.step,
           coalesce(e.line_id, e.event),
           left(concat_ws(' · ', e.checkout_session_id, e.utm_source, e.utm_campaign), 240),
           buyer.email
    FROM public.kit_events e
    JOIN (
      SELECT DISTINCT checkout_session_id, lower(email) AS email
      FROM (
        SELECT checkout_session_id, email FROM public.kit_purchases
        WHERE checkout_session_id IS NOT NULL AND email IS NOT NULL
        UNION
        SELECT stripe_checkout_session_id, email FROM public.checkout_sessions
        WHERE email IS NOT NULL
      ) sessions
    ) buyer ON buyer.checkout_session_id = e.checkout_session_id
    JOIN person p ON p.email <> '' AND buyer.email = p.email

    UNION ALL
    SELECT o.created_at, 'one_feature_training_leads', 'training_lead', o.selected_plan,
           o.page,
           left(concat_ws(' · ', o.form, o.name), 240),
           o.email
    FROM public.one_feature_training_leads o, person p
    WHERE p.email <> '' AND lower(o.email) = p.email
  ) events
  ORDER BY occurred_at NULLS LAST, source;
$$;

REVOKE ALL ON FUNCTION public.customer_timeline(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_timeline(text) TO service_role;

COMMENT ON FUNCTION public.customer_timeline(text) IS
  'Read-only chronological journey for one email. Service role and the SQL editor can run it. Anon and signed-in clients cannot.';
