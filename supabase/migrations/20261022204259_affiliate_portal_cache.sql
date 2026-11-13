-- Daily cache of affiliate portal status so the page does not call Stripe on every view.
-- Affiliates can read their own row. Platform admins can read every row.
-- Writes stay on the service role (the portal function and the daily cron).

CREATE TABLE IF NOT EXISTS public.affiliate_portal_cache (
  affiliate_id uuid PRIMARY KEY REFERENCES public.affiliates(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.affiliate_portal_cache IS
  'Last daily snapshot of referral status, paid invoices, expected trial commission, and page totals. The portal reads this instead of calling Stripe on every page view.';

ALTER TABLE public.affiliate_portal_cache ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.affiliate_portal_cache TO authenticated;
GRANT ALL ON public.affiliate_portal_cache TO service_role;

DO $$
BEGIN
  CREATE POLICY "Affiliates can view own portal cache"
  ON public.affiliate_portal_cache FOR SELECT TO authenticated
  USING (public.can_access_affiliate(affiliate_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Platform admin can view portal cache"
  ON public.affiliate_portal_cache FOR SELECT TO authenticated
  USING (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Cron auth secret. Clients cannot read it. The daily job sends it as x-webhook-secret.
CREATE TABLE IF NOT EXISTS public.affiliate_portal_cache_cron_auth (
  id integer PRIMARY KEY CHECK (id = 1),
  secret text NOT NULL
);

ALTER TABLE public.affiliate_portal_cache_cron_auth ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "No client access to affiliate cache cron secret"
  ON public.affiliate_portal_cache_cron_auth
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT ALL ON public.affiliate_portal_cache_cron_auth TO service_role;

INSERT INTO public.affiliate_portal_cache_cron_auth (id, secret)
SELECT 1, encode(extensions.gen_random_bytes(32), 'hex')
WHERE NOT EXISTS (SELECT 1 FROM public.affiliate_portal_cache_cron_auth WHERE id = 1);

CREATE OR REPLACE FUNCTION public.invoke_refresh_affiliate_portal_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions, pg_temp
AS $$
DECLARE
  cron_secret text;
BEGIN
  SELECT secret INTO cron_secret FROM public.affiliate_portal_cache_cron_auth WHERE id = 1;
  IF cron_secret IS NULL OR btrim(cron_secret) = '' THEN
    RAISE WARNING 'affiliate portal cache cron skipped: auth secret missing';
    RETURN;
  END IF;
  -- 14:30 UTC is 9:30 AM US Central during daylight time. The batch stops itself
  -- before the edge timeout and the next day picks up anyone still stale.
  PERFORM net.http_post(
    url := 'https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/affiliate-referrals',
    body := '{"action":"refresh-batch"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', cron_secret
    ),
    timeout_milliseconds := 120000
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'affiliate portal cache cron invoke failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_refresh_affiliate_portal_cache() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_refresh_affiliate_portal_cache() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-affiliate-portal-cache') THEN
    PERFORM cron.unschedule('refresh-affiliate-portal-cache');
  END IF;
END $$;

SELECT cron.schedule(
  'refresh-affiliate-portal-cache',
  '30 14 * * *',
  $$SELECT public.invoke_refresh_affiliate_portal_cache();$$
);
