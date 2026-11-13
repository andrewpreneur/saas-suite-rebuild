-- Affiliate referral status, per-affiliate commission rates, and page attribution.
-- Additive only. Existing affiliate_referrals.commission_rate values are left as they are.
-- New referrals copy affiliates.commission_rate (default 30) at insert time.
--
-- Configuration Andrew reviews before applying:
--   * affiliate 15e6d7bf-3e08-4974-a8b5-8e6217382f39 (slug russel) is set to 70%
--     so future ?ref=russel signups inherit 70%. Older referral rows stay at their stored rate.
--   * That same affiliate receives the /one-feature-kit page attribution.
--     Application code does not name this affiliate; the row is the switch.

ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS commission_rate numeric(5,2) NOT NULL DEFAULT 30;

DO $$
BEGIN
  ALTER TABLE public.affiliates
    ADD CONSTRAINT affiliates_commission_rate_range
    CHECK (commission_rate >= 0 AND commission_rate <= 100);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.affiliates.commission_rate IS
  'Percent copied onto new affiliate_referrals rows. Default 30. Existing referral rates are not rewritten when this changes.';

-- Affiliates can update their own row. They must not be able to raise their own rate.
CREATE OR REPLACE FUNCTION public.protect_affiliate_commission_rate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.commission_rate := 30;
  ELSE
    NEW.commission_rate := OLD.commission_rate;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_affiliate_commission_rate() FROM PUBLIC, anon, authenticated;

-- Set the special rate before the trigger exists. The trigger blocks a non-admin
-- session from writing this column, and a migration has no user JWT.
UPDATE public.affiliates
SET commission_rate = 70
WHERE id = '15e6d7bf-3e08-4974-a8b5-8e6217382f39';

DO $$
BEGIN
  CREATE TRIGGER trg_protect_affiliate_commission_rate
  BEFORE INSERT OR UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.protect_affiliate_commission_rate();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Invoice-backed commission rows. period_index stays required; invoice rows use the
-- invoice created unix time, which does not collide with the old 0..N monthly indexes.
ALTER TABLE public.affiliate_commissions
  ADD COLUMN IF NOT EXISTS stripe_invoice_id text,
  ADD COLUMN IF NOT EXISTS amount_refunded numeric(10,2) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_commissions_stripe_invoice_uidx
  ON public.affiliate_commissions (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

COMMENT ON COLUMN public.affiliate_commissions.stripe_invoice_id IS
  'Stripe invoice this commission was accrued from. Rows without this id are the older list-price estimates and are not paid out.';
COMMENT ON COLUMN public.affiliate_commissions.plan_amount IS
  'Net amount collected on the Stripe invoice (amount paid minus refunds), in major units.';
COMMENT ON COLUMN public.affiliate_commissions.amount_refunded IS
  'Portion of the invoice that was refunded or credited back, in major units.';

CREATE TABLE IF NOT EXISTS public.affiliate_page_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  page_path text NOT NULL CHECK (page_path ~ '^/[^?#]{0,199}$'),
  funnel_key text CHECK (funnel_key IS NULL OR char_length(funnel_key) BETWEEN 1 AND 80),
  label text CHECK (label IS NULL OR char_length(label) <= 120),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_page_attributions_identity
  ON public.affiliate_page_attributions (affiliate_id, page_path, COALESCE(funnel_key, ''));

CREATE INDEX IF NOT EXISTS affiliate_page_attributions_affiliate_idx
  ON public.affiliate_page_attributions (affiliate_id);

COMMENT ON TABLE public.affiliate_page_attributions IS
  'Gives one affiliate credit for a public page. Funnel stats for that path are read in the affiliate portal. No affiliate is named in application code.';

ALTER TABLE public.affiliate_page_attributions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_page_attributions TO authenticated;
GRANT ALL ON public.affiliate_page_attributions TO service_role;

DO $$
BEGIN
  CREATE POLICY "Affiliates can view own page attributions"
  ON public.affiliate_page_attributions FOR SELECT TO authenticated
  USING (public.can_access_affiliate(affiliate_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Platform admin can manage page attributions"
  ON public.affiliate_page_attributions FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.affiliate_page_attributions (affiliate_id, page_path, funnel_key, label, starts_at)
SELECT a.id, '/one-feature-kit', 'one-feature-kit', 'One Feature Kit', timestamptz '2024-01-01'
FROM public.affiliates a
WHERE a.id = '15e6d7bf-3e08-4974-a8b5-8e6217382f39'
  AND NOT EXISTS (
    SELECT 1 FROM public.affiliate_page_attributions x
    WHERE x.affiliate_id = a.id AND x.page_path = '/one-feature-kit'
  );

-- New signups copy the affiliate rate. This is the latest register_starter_user body.
CREATE OR REPLACE FUNCTION public.register_starter_user(user_email text, user_affiliate_id text DEFAULT NULL::text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  existing_user RECORD;
  aff_id uuid := NULL;
  resolved_affiliate text;
BEGIN
  SELECT id, approval INTO existing_user FROM saas_suite_users WHERE lower(email) = lower(user_email);
  IF existing_user.id IS NOT NULL THEN RETURN TRUE; END IF;

  -- Invited team admins only get access to the account they were added to.
  IF EXISTS (SELECT 1 FROM account_admins aa
             WHERE lower(aa.admin_email) = lower(user_email)
               AND aa.status IN ('accepted','pending')
               AND lower(aa.owner_email) <> lower(user_email)) THEN
    RETURN TRUE;
  END IF;

  resolved_affiliate := user_affiliate_id;
  IF user_affiliate_id IS NOT NULL AND btrim(user_affiliate_id) <> '' THEN
    SELECT a.id INTO aff_id FROM affiliates a
    WHERE a.affiliate_slug = user_affiliate_id OR a.id::text = user_affiliate_id LIMIT 1;
    IF aff_id IS NOT NULL THEN resolved_affiliate := aff_id::text; END IF;
  END IF;

  INSERT INTO saas_suite_users (email, approval, plan, trial_start_date, affiliate_id, source, max_onboarding_users)
  VALUES (lower(user_email), 'YES', 'STARTER', NULL, resolved_affiliate, 'signup', 1);

  IF aff_id IS NOT NULL THEN
    INSERT INTO affiliate_referrals (affiliate_id, referred_email, plan, status, commission_rate)
    SELECT aff_id, lower(user_email), 'STARTER', 'signup', COALESCE(a.commission_rate, 30)
    FROM affiliates a
    WHERE a.id = aff_id
    ON CONFLICT (affiliate_id, referred_email) DO NOTHING;
    INSERT INTO affiliate_events (affiliate_id, event_type, page) VALUES (aff_id, 'signup', 'signup');
  END IF;
  RETURN TRUE;
END;
$function$;

CREATE INDEX IF NOT EXISTS kit_purchases_created_idx ON public.kit_purchases (created_at);
CREATE INDEX IF NOT EXISTS one_feature_training_leads_page_created_idx
  ON public.one_feature_training_leads (page, created_at);

-- Aggregates only. Service role calls this from affiliate-referrals. Clients cannot.
CREATE OR REPLACE FUNCTION public.affiliate_page_funnel_stats(
  p_page_path text,
  p_funnel_key text,
  p_since timestamptz,
  p_until timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := p_since;
  v_until timestamptz := p_until;
  v_path text := left(coalesce(p_page_path, ''), 200);
  v_funnel text := left(coalesce(p_funnel_key, ''), 80);
  v_like text;
  v_slug text;
  v_kit boolean;
  v_visits bigint := 0;
  v_unique bigint := 0;
  v_clicks bigint := 0;
  v_funnel_sessions bigint := 0;
  v_leads bigint := 0;
  v_checkout_starts bigint := 0;
  v_purchases bigint := 0;
  v_revenue bigint := 0;
  v_customers jsonb := '[]'::jsonb;
BEGIN
  PERFORM set_config('statement_timeout', '20000', true);
  IF v_since IS NULL OR v_until IS NULL OR v_since >= v_until OR v_path !~ '^/' THEN
    RETURN jsonb_build_object('error', 'invalid_range');
  END IF;
  IF v_until - v_since > interval '366 days' THEN
    v_since := v_until - interval '366 days';
  END IF;

  v_like := replace(replace(replace(v_path, '\', '\\'), '%', '\%'), '_', '\_');
  v_slug := lower(trim(both '/' from v_path));
  v_kit := lower(v_funnel) = 'one-feature-kit'
    OR lower(v_path) = '/one-feature-kit'
    OR lower(v_path) LIKE '/one-feature-kit/%';

  SELECT count(*),
         count(DISTINCT COALESCE(NULLIF(visitor_key, ''), NULLIF(session_id, ''), id::text))
    INTO v_visits, v_unique
  FROM public.site_analytics_events
  WHERE created_at >= v_since
    AND created_at < v_until
    AND event_type = 'pageview'
    AND (path = v_path OR path LIKE v_like || '/%' ESCAPE '\')
    AND coalesce(metadata->>'is_test', '') NOT IN ('1', 'true', 't')
    AND coalesce(metadata->>'ofk_test', '') NOT IN ('1', 'true', 't')
    AND coalesce(lower(utm_source), '') <> 'qa_test'
    AND coalesce(lower(fbclid), '') <> 'test';

  SELECT count(*) INTO v_clicks
  FROM public.site_analytics_events
  WHERE created_at >= v_since
    AND created_at < v_until
    AND event_type = 'click'
    AND (path = v_path OR path LIKE v_like || '/%' ESCAPE '\')
    AND coalesce(metadata->>'is_test', '') NOT IN ('1', 'true', 't')
    AND coalesce(metadata->>'ofk_test', '') NOT IN ('1', 'true', 't')
    AND coalesce(lower(utm_source), '') <> 'qa_test'
    AND coalesce(lower(fbclid), '') <> 'test';

  SELECT count(*) INTO v_leads
  FROM public.one_feature_training_leads
  WHERE created_at >= v_since
    AND created_at < v_until
    AND (
      lower(page) = v_slug
      OR lower(page) = lower(v_path)
      OR (v_funnel <> '' AND lower(page) = lower(v_funnel))
    )
    AND coalesce(lower(utm->>'utm_source'), '') <> 'qa_test'
    AND coalesce(lower(utm->>'fbclid'), '') <> 'test';

  IF v_kit THEN
    SELECT count(DISTINCT session_id) INTO v_funnel_sessions
    FROM public.kit_events
    WHERE created_at >= v_since
      AND created_at < v_until
      AND event = 'view'
      AND is_test IS NOT TRUE
      AND coalesce(lower(utm_source), '') <> 'qa_test'
      AND coalesce(lower(fbclid), '') <> 'test';

    SELECT v_clicks + count(*) INTO v_clicks
    FROM public.kit_events
    WHERE created_at >= v_since
      AND created_at < v_until
      AND event IN ('cta_click', 'checkout_start')
      AND is_test IS NOT TRUE
      AND coalesce(lower(utm_source), '') <> 'qa_test'
      AND coalesce(lower(fbclid), '') <> 'test';

    SELECT count(DISTINCT session_id) INTO v_checkout_starts
    FROM public.kit_events
    WHERE created_at >= v_since
      AND created_at < v_until
      AND event = 'checkout_start'
      AND is_test IS NOT TRUE
      AND coalesce(lower(utm_source), '') <> 'qa_test'
      AND coalesce(lower(fbclid), '') <> 'test';

    IF coalesce(v_checkout_starts, 0) = 0 THEN
      SELECT count(*) INTO v_checkout_starts
      FROM public.checkout_sessions
      WHERE created_at >= v_since
        AND created_at < v_until
        AND flow = 'one_feature_kit'
        AND coalesce(status, '') <> 'failed'
        AND coalesce(stripe_checkout_session_id, '') NOT LIKE 'cs_test_%'
        AND coalesce(lower(metadata->>'utm_source'), '') <> 'qa_test'
        AND coalesce(lower(metadata->>'fbclid'), '') <> 'test';
    END IF;

    SELECT count(DISTINCT checkout_session_id), coalesce(sum(amount_cents), 0)
      INTO v_purchases, v_revenue
    FROM public.kit_purchases p
    WHERE p.created_at >= v_since
      AND p.created_at < v_until
      AND p.comped IS NOT TRUE
      AND p.amount_cents > 0
      AND p.checkout_session_id NOT LIKE 'cs_test_%'
      AND NOT EXISTS (
        SELECT 1 FROM public.kit_events e
        WHERE e.checkout_session_id = p.checkout_session_id
          AND (
            e.is_test IS TRUE
            OR lower(coalesce(e.utm_source, '')) = 'qa_test'
            OR lower(coalesce(e.fbclid, '')) = 'test'
          )
      );

    SELECT coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
      INTO v_customers
    FROM (
      SELECT lower(p.email) AS email,
             p.created_at AS paid_at,
             p.amount_cents,
             p.line_id,
             p.comped
      FROM public.kit_purchases p
      WHERE p.created_at >= v_since
        AND p.created_at < v_until
        AND p.checkout_session_id NOT LIKE 'cs_test_%'
        AND NOT EXISTS (
          SELECT 1 FROM public.kit_events e
          WHERE e.checkout_session_id = p.checkout_session_id
            AND (
              e.is_test IS TRUE
              OR lower(coalesce(e.utm_source, '')) = 'qa_test'
              OR lower(coalesce(e.fbclid, '')) = 'test'
            )
        )
      ORDER BY p.created_at DESC
      LIMIT 500
    ) c;
  ELSE
    SELECT count(*) INTO v_checkout_starts
    FROM public.checkout_sessions
    WHERE created_at >= v_since
      AND created_at < v_until
      AND coalesce(status, '') <> 'failed'
      AND coalesce(stripe_checkout_session_id, '') NOT LIKE 'cs_test_%'
      AND coalesce(lower(metadata->>'utm_source'), '') <> 'qa_test'
      AND coalesce(lower(metadata->>'fbclid'), '') <> 'test'
      AND (page = v_path OR page LIKE v_like || '/%' ESCAPE '\');

    SELECT count(*), coalesce(sum(amount_cents), 0)
      INTO v_purchases, v_revenue
    FROM public.checkout_sessions
    WHERE created_at >= v_since
      AND created_at < v_until
      AND status = 'completed'
      AND coalesce(amount_cents, 0) > 0
      AND coalesce(stripe_checkout_session_id, '') NOT LIKE 'cs_test_%'
      AND coalesce(lower(metadata->>'utm_source'), '') <> 'qa_test'
      AND coalesce(lower(metadata->>'fbclid'), '') <> 'test'
      AND (page = v_path OR page LIKE v_like || '/%' ESCAPE '\');
  END IF;

  RETURN jsonb_build_object(
    'visits', coalesce(v_visits, 0),
    'unique_visitors', coalesce(v_unique, 0),
    'clicks', coalesce(v_clicks, 0),
    'funnel_sessions', CASE WHEN v_kit THEN coalesce(v_funnel_sessions, 0) ELSE NULL END,
    'leads', coalesce(v_leads, 0),
    'checkout_starts', coalesce(v_checkout_starts, 0),
    'purchases', coalesce(v_purchases, 0),
    'revenue_cents', coalesce(v_revenue, 0),
    'customers', coalesce(v_customers, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.affiliate_page_funnel_stats(text, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_page_funnel_stats(text, text, timestamptz, timestamptz) TO service_role;

-- App email -> the Stripe customer that actually pays. Read by the affiliate portal and the daily job.
CREATE TABLE IF NOT EXISTS public.affiliate_billing_overrides (
  referred_email text PRIMARY KEY,
  stripe_email text,
  stripe_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_billing_overrides_target CHECK (
    coalesce(btrim(stripe_email), '') <> '' OR coalesce(btrim(stripe_customer_id), '') <> ''
  )
);

COMMENT ON TABLE public.affiliate_billing_overrides IS
  'Maps a referred app email to the Stripe email or customer id that pays. The portal does not guess this.';

ALTER TABLE public.affiliate_billing_overrides ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.affiliate_billing_overrides TO service_role;

DO $$
BEGIN
  CREATE POLICY "Platform admin can manage billing overrides"
  ON public.affiliate_billing_overrides FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.affiliate_billing_overrides (referred_email, stripe_email)
VALUES ('craig@botsguy.com', 'smartsites@gmail.com')
ON CONFLICT (referred_email) DO NOTHING;

-- Daily views, clicks and signups for one affiliate. Revenue is added from Stripe in the edge function.
CREATE OR REPLACE FUNCTION public.affiliate_portal_series(
  p_affiliate_id uuid,
  p_slug text,
  p_since timestamptz,
  p_until timestamptz,
  p_page_paths text[]
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := p_since;
  v_until timestamptz := p_until;
  v_slug text := left(coalesce(p_slug, ''), 80);
  v_paths text[] := coalesce(p_page_paths, ARRAY[]::text[]);
  v_kit boolean := false;
  v_days jsonb := '[]'::jsonb;
BEGIN
  PERFORM set_config('statement_timeout', '20000', true);
  IF v_since IS NULL OR v_until IS NULL OR v_since >= v_until OR p_affiliate_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;
  IF v_until - v_since > interval '366 days' THEN
    v_since := v_until - interval '366 days';
  END IF;
  v_kit := EXISTS (
    SELECT 1 FROM unnest(v_paths) AS path
    WHERE lower(path) = '/one-feature-kit' OR lower(path) LIKE '/one-feature-kit/%'
  );

  WITH days AS (
    SELECT generate_series(
      date_trunc('day', v_since),
      date_trunc('day', v_until - interval '1 second'),
      interval '1 day'
    )::date AS day
  ),
  link_events AS (
    SELECT date_trunc('day', created_at)::date AS day,
           count(*) FILTER (WHERE event_type = 'view') AS views,
           count(*) FILTER (WHERE event_type = 'click') AS clicks
    FROM public.affiliate_events
    WHERE affiliate_id = p_affiliate_id
      AND created_at >= v_since
      AND created_at < v_until
      AND event_type IN ('view', 'click')
    GROUP BY 1
  ),
  page_events AS (
    SELECT date_trunc('day', created_at)::date AS day,
           count(*) FILTER (WHERE event_type = 'pageview') AS views,
           count(*) FILTER (WHERE event_type = 'click') AS clicks
    FROM public.site_analytics_events
    WHERE cardinality(v_paths) > 0
      AND created_at >= v_since
      AND created_at < v_until
      AND event_type IN ('pageview', 'click')
      AND coalesce(metadata->>'is_test', '') NOT IN ('1', 'true', 't')
      AND coalesce(metadata->>'ofk_test', '') NOT IN ('1', 'true', 't')
      AND coalesce(lower(utm_source), '') <> 'qa_test'
      AND coalesce(lower(fbclid), '') <> 'test'
      AND EXISTS (
        SELECT 1 FROM unnest(v_paths) AS prefix
        WHERE path = prefix OR path LIKE replace(replace(replace(prefix, '\', '\\'), '%', '\%'), '_', '\_') || '/%' ESCAPE '\'
      )
    GROUP BY 1
  ),
  kit_clicks AS (
    SELECT date_trunc('day', created_at)::date AS day,
           count(*) AS clicks
    FROM public.kit_events
    WHERE v_kit
      AND created_at >= v_since
      AND created_at < v_until
      AND event IN ('cta_click', 'checkout_start')
      AND is_test IS NOT TRUE
      AND coalesce(lower(utm_source), '') <> 'qa_test'
      AND coalesce(lower(fbclid), '') <> 'test'
    GROUP BY 1
  ),
  signups AS (
    SELECT date_trunc('day', created_at)::date AS day,
           count(*) AS signups
    FROM public.saas_suite_users
    WHERE created_at >= v_since
      AND created_at < v_until
      AND (
        affiliate_id = p_affiliate_id::text
        OR (v_slug <> '' AND affiliate_id = v_slug)
      )
    GROUP BY 1
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'date', to_char(d.day, 'YYYY-MM-DD'),
    'views', coalesce(l.views, 0) + coalesce(p.views, 0),
    'clicks', coalesce(l.clicks, 0) + coalesce(p.clicks, 0) + coalesce(k.clicks, 0),
    'signups', coalesce(s.signups, 0)
  ) ORDER BY d.day), '[]'::jsonb)
  INTO v_days
  FROM days d
  LEFT JOIN link_events l ON l.day = d.day
  LEFT JOIN page_events p ON p.day = d.day
  LEFT JOIN kit_clicks k ON k.day = d.day
  LEFT JOIN signups s ON s.day = d.day;

  RETURN v_days;
END;
$$;

REVOKE ALL ON FUNCTION public.affiliate_portal_series(uuid, text, timestamptz, timestamptz, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_portal_series(uuid, text, timestamptz, timestamptz, text[]) TO service_role;
