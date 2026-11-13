CREATE TABLE IF NOT EXISTS public.store_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  app_user_id text,
  store text NOT NULL DEFAULT 'unknown',
  product_id text NOT NULL DEFAULT '',
  entitlement text,
  plan text,
  premium_support boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  last_event text,
  raw_event jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS store_subscriptions_email_product_idx
  ON public.store_subscriptions (lower(email), product_id);

GRANT SELECT ON public.store_subscriptions TO authenticated;
GRANT ALL ON public.store_subscriptions TO service_role;

ALTER TABLE public.store_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own store subscriptions" ON public.store_subscriptions;
CREATE POLICY "Users can view their own store subscriptions"
  ON public.store_subscriptions FOR SELECT TO authenticated
  USING (lower(email) = lower(coalesce(public.current_auth_email(), '')));

CREATE OR REPLACE FUNCTION public.store_subscriptions_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS store_subscriptions_updated_at ON public.store_subscriptions;
CREATE TRIGGER store_subscriptions_updated_at
  BEFORE UPDATE ON public.store_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.store_subscriptions_touch_updated_at();

-- Applies (or revokes) access bought through the Apple App Store / Google Play.
-- Called only by the RevenueCat webhook edge function with the service role.
CREATE OR REPLACE FUNCTION public.apply_store_subscription(
  p_email text,
  p_store text,
  p_product_id text,
  p_entitlement text,
  p_plan text,
  p_premium boolean,
  p_active boolean,
  p_expires timestamptz,
  p_app_user_id text,
  p_event text,
  p_raw jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_plan text := upper(coalesce(p_plan, ''));
  v_best_plan text;
  v_premium boolean;
BEGIN
  IF v_email = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_email');
  END IF;

  INSERT INTO public.store_subscriptions (
    email, app_user_id, store, product_id, entitlement, plan,
    premium_support, is_active, expires_at, last_event, raw_event
  ) VALUES (
    v_email, p_app_user_id, coalesce(p_store, 'unknown'), coalesce(p_product_id, ''),
    p_entitlement, nullif(v_plan, ''), coalesce(p_premium, false),
    coalesce(p_active, false), p_expires, p_event, p_raw
  )
  ON CONFLICT (lower(email), product_id) DO UPDATE SET
    app_user_id = coalesce(excluded.app_user_id, public.store_subscriptions.app_user_id),
    store = excluded.store,
    entitlement = excluded.entitlement,
    plan = excluded.plan,
    premium_support = excluded.premium_support,
    is_active = excluded.is_active,
    expires_at = excluded.expires_at,
    last_event = excluded.last_event,
    raw_event = excluded.raw_event,
    updated_at = now();

  -- Best plan across every still-active store purchase for this account.
  SELECT CASE
           WHEN max(CASE WHEN plan = 'ADVANCED' THEN 2 WHEN plan = 'BASIC' THEN 1 ELSE 0 END) = 2 THEN 'ADVANCED'
           WHEN max(CASE WHEN plan = 'ADVANCED' THEN 2 WHEN plan = 'BASIC' THEN 1 ELSE 0 END) = 1 THEN 'BASIC'
           ELSE NULL
         END,
         bool_or(premium_support)
  INTO v_best_plan, v_premium
  FROM public.store_subscriptions
  WHERE lower(email) = v_email AND is_active = true;

  IF v_best_plan IS NOT NULL THEN
    UPDATE public.saas_suite_users
       SET plan = v_best_plan::public.plan_type,
           premium_support = coalesce(v_premium, false) OR coalesce(premium_support, false),
           approval = CASE WHEN approval = 'NO' THEN approval ELSE 'YES' END
     WHERE lower(email) = v_email;
  ELSE
    -- No active store purchase left. Never downgrade an account that pays by
    -- card on the website: only clear plans we granted from a store purchase.
    UPDATE public.saas_suite_users u
       SET plan = 'STARTER'::public.plan_type,
           premium_support = false
     WHERE lower(u.email) = v_email
       AND EXISTS (
         SELECT 1 FROM public.store_subscriptions s
          WHERE lower(s.email) = v_email AND s.plan IS NOT NULL
       )
       AND coalesce(u.stripe_customer_id, '') = '';
  END IF;

  RETURN jsonb_build_object('ok', true, 'email', v_email, 'plan', coalesce(v_best_plan, 'STARTER'), 'premium_support', coalesce(v_premium, false));
END;
$$;

REVOKE ALL ON FUNCTION public.apply_store_subscription(text, text, text, text, text, boolean, boolean, timestamptz, text, text, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_store_subscription(text, text, text, text, text, boolean, boolean, timestamptz, text, text, jsonb) TO service_role;