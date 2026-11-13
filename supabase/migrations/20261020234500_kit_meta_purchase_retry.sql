-- Retry unfinished kit Meta Purchases.
-- Adds an attempt counter and a pg_cron job that calls retry-kit-meta-purchases.
-- Apply only with Andrew's approval. This file is not applied by the pull request.

ALTER TABLE public.one_feature_kit_actions
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.one_feature_kit_actions.attempts IS
  'Failed kit Meta retry sends. Login, Slack, Lynkific, and upsell claims stay at 0.';

CREATE INDEX IF NOT EXISTS one_feature_kit_actions_meta_retry_idx
  ON public.one_feature_kit_actions (lease_until)
  WHERE completed = false AND action_key LIKE 'meta:%';

CREATE TABLE IF NOT EXISTS public.kit_meta_retry_auth (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.kit_meta_retry_auth IS
  'Secret the Meta retry cron sends. No client access.';

ALTER TABLE public.kit_meta_retry_auth ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.kit_meta_retry_auth FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.kit_meta_retry_auth TO service_role;

DROP POLICY IF EXISTS "kit meta retry auth deny clients" ON public.kit_meta_retry_auth;
CREATE POLICY "kit meta retry auth deny clients"
  ON public.kit_meta_retry_auth
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

INSERT INTO public.kit_meta_retry_auth (id, secret)
SELECT 1, encode(extensions.gen_random_bytes(32), 'hex')
WHERE NOT EXISTS (SELECT 1 FROM public.kit_meta_retry_auth WHERE id = 1);

CREATE OR REPLACE FUNCTION public.invoke_retry_kit_meta_purchases()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions, pg_temp
AS $$
DECLARE
  retry_secret text;
BEGIN
  SELECT secret INTO retry_secret FROM public.kit_meta_retry_auth WHERE id = 1;
  IF retry_secret IS NULL OR btrim(retry_secret) = '' THEN
    RAISE WARNING 'kit meta retry skipped: auth secret missing';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/retry-kit-meta-purchases',
    body := '{"source":"cron"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', retry_secret
    ),
    timeout_milliseconds := 15000
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'kit meta retry invoke failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_retry_kit_meta_purchases() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_retry_kit_meta_purchases() TO service_role;

SELECT cron.unschedule('retry-kit-meta-purchases')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'retry-kit-meta-purchases');

SELECT cron.schedule(
  'retry-kit-meta-purchases',
  '*/2 * * * *',
  $$SELECT public.invoke_retry_kit_meta_purchases();$$
);

NOTIFY pgrst, 'reload schema';
