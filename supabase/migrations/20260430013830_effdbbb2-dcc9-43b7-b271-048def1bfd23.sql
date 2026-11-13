
-- Unschedule any prior version with the same name (idempotent)
DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'expire-payment-grace-daily';
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'expire-payment-grace-daily',
  '15 9 * * *',  -- 09:15 UTC every day
  $$
  SELECT net.http_post(
    url := 'https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/expire-payment-grace',
    headers := '{"Content-Type":"application/json","apikey":"disconnected"}'::jsonb,
    body := jsonb_build_object('triggered_at', now())
  );
  $$
);
