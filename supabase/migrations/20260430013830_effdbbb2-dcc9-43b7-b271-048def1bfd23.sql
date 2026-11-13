
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
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqcWVlYnllcXR6enFtbXd2ZmdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NDQ0OTYsImV4cCI6MjA2MzUyMDQ5Nn0.x1Y9McmvpMkJ8GwIp315zEGQHdIomj4ChUpj7eyUqdo"}'::jsonb,
    body := jsonb_build_object('triggered_at', now())
  );
  $$
);
